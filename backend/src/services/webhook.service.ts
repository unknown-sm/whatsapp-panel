import prisma from "../lib/prisma";
import bcrypt from "bcrypt";
import crypto from "crypto";

const VALID_ACTIONS = [
  "create_contact",
  "update_contact",
  "create_deal",
  "move_deal",
  "add_score",
  "send_template",
  "add_note",
  "add_tags",
];

export function generateSecret(): string {
  return `wh_${crypto.randomBytes(24).toString("hex")}`;
}

export async function getConfig(orgId: string) {
  return prisma.webhookConfig.findUnique({
    where: { orgId },
    select: {
      id: true,
      orgId: true,
      isEnabled: true,
      allowedActions: true,
      lastTriggered: true,
      triggerCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function setConfig(orgId: string, data: { isEnabled?: boolean; allowedActions?: string[] }) {
  const existing = await prisma.webhookConfig.findUnique({ where: { orgId } });
  if (!existing) {
    const secret = generateSecret();
    const secretHash = await bcrypt.hash(secret, 12);
    return prisma.webhookConfig.create({
      data: {
        orgId,
        secretHash,
        isEnabled: data.isEnabled ?? true,
        allowedActions: data.allowedActions || undefined,
      },
    }).then(() => ({ ...data, secret }));
  }
  await prisma.webhookConfig.update({
    where: { orgId },
    data: {
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
      ...(data.allowedActions ? { allowedActions: data.allowedActions } : {}),
    },
  });
  return data;
}

export async function regenerateSecret(orgId: string) {
  const secret = generateSecret();
  const secretHash = await bcrypt.hash(secret, 12);
  await prisma.webhookConfig.upsert({
    where: { orgId },
    create: { orgId, secretHash },
    update: { secretHash },
  });
  return secret;
}

export async function triggerWebhook(orgId: string, secret: string, action: string, payload: any) {
  const config = await prisma.webhookConfig.findUnique({ where: { orgId } });
  if (!config) throw new Error("Webhook no configurado para esta organizacion");
  if (!config.isEnabled) throw new Error("Webhook deshabilitado");

  const valid = await bcrypt.compare(secret, config.secretHash);
  if (!valid) throw new Error("Secret invalido");

  const allowed = (config.allowedActions as string[]);
  if (!allowed.includes(action)) throw new Error(`Accion "${action}" no permitida`);

  const result = await dispatchAction(orgId, action, payload);

  await prisma.webhookConfig.update({
    where: { orgId },
    data: { lastTriggered: new Date(), triggerCount: { increment: 1 } },
  });

  return result;
}

async function upsertTag(name: string) {
  return prisma.tag.upsert({ where: { name }, create: { name }, update: {} });
}

async function addTagsToContact(contactId: string, tags: string[]) {
  for (const t of tags) {
    const tag = await upsertTag(t);
    await prisma.contactTags.create({
      data: { contactId, tagId: tag.id },
    }).catch(() => {}); // ignore if already exists
  }
}

async function findOrCreateScoreRule(orgId: string, condition: string, points: number) {
  const conditionEnum = condition as any;
  let rule = await prisma.leadScoreRule.findFirst({
    where: { orgId, condition: conditionEnum },
  });
  if (!rule) {
    rule = await prisma.leadScoreRule.create({
      data: {
        orgId,
        name: `Webhook: ${condition}`,
        condition: conditionEnum,
        points,
        isActive: true,
      },
    });
  }
  return rule;
}

async function dispatchAction(orgId: string, action: string, payload: any) {
  switch (action) {
    case "create_contact": {
      const { phone, name, tags } = payload;
      if (!phone) throw new Error("phone requerido");
      const existing = await prisma.contact.findFirst({ where: { phone, orgId } });
      if (existing) {
        if (tags?.length) await addTagsToContact(existing.id, tags);
        return { action, contactId: existing.id, existed: true };
      }
      const contact = await prisma.contact.create({
        data: { phone, name: name || phone, orgId },
      });
      if (tags?.length) await addTagsToContact(contact.id, tags);
      return { action, contactId: contact.id, created: true };
    }

    case "update_contact": {
      const { phone, data } = payload;
      if (!phone) throw new Error("phone requerido");
      const contact = await prisma.contact.findFirst({ where: { phone, orgId } });
      if (!contact) throw new Error("Contacto no encontrado");
      const updateData: any = {};
      if (data.name) updateData.name = data.name;
      await prisma.contact.update({ where: { id: contact.id }, data: updateData });
      return { action, contactId: contact.id, updated: true };
    }

    case "create_deal": {
      const { contactPhone, pipelineId, stageId, title, value, priority } = payload;
      if (!contactPhone || !title) throw new Error("contactPhone y title requeridos");
      const contact = await prisma.contact.findFirst({ where: { phone: contactPhone, orgId } });
      if (!contact) throw new Error("Contacto no encontrado");
      const pipeline = pipelineId
        ? await prisma.pipeline.findFirst({ where: { id: pipelineId, orgId } })
        : await prisma.pipeline.findFirst({ where: { orgId } });
      if (!pipeline) throw new Error("Pipeline no encontrado");
      const stage = stageId
        ? await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId: pipeline.id } })
        : await prisma.pipelineStage.findFirst({ where: { pipelineId: pipeline.id }, orderBy: { order: "asc" } });
      if (!stage) throw new Error("Stage no encontrado");
      const deal = await prisma.deal.create({
        data: {
          orgId,
          name: title,
          value: value || 0,
          currency: payload.currency || "USD",
          priority: priority || "MEDIUM",
          contactId: contact.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
        },
      });
      return { action, dealId: deal.id, created: true };
    }

    case "move_deal": {
      const { dealId, stageId } = payload;
      if (!dealId || !stageId) throw new Error("dealId y stageId requeridos");
      const deal = await prisma.deal.findFirst({ where: { id: dealId, orgId } });
      if (!deal) throw new Error("Deal no encontrado");
      const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId } });
      if (!stage) throw new Error("Stage no encontrado");
      const updated = await prisma.deal.update({ where: { id: dealId }, data: { stageId } });
      return { action, dealId: updated.id, stageId, moved: true };
    }

    case "add_score": {
      const { contactPhone, condition, points, description } = payload;
      if (!contactPhone || !condition || points === undefined) throw new Error("contactPhone, condition y points requeridos");
      const contact = await prisma.contact.findFirst({ where: { phone: contactPhone, orgId } });
      if (!contact) throw new Error("Contacto no encontrado");
      const rule = await findOrCreateScoreRule(orgId, condition, points);
      const score = await prisma.leadScore.create({
        data: {
          contactId: contact.id,
          ruleId: rule.id,
          points,
          reason: description || `Webhook: ${condition}`,
        },
      });
      return { action, scoreId: score.id, added: true };
    }

    case "send_template": {
      const { contactPhone, templateName, params } = payload;
      if (!contactPhone || !templateName) throw new Error("contactPhone y templateName requeridos");
      const contact = await prisma.contact.findFirst({ where: { phone: contactPhone, orgId } });
      if (!contact) throw new Error("Contacto no encontrado");
      const template = await prisma.messageTemplate.findFirst({
        where: { name: templateName, orgId },
        select: { id: true, name: true, bodyText: true },
      });
      if (!template) throw new Error(`Template "${templateName}" no encontrado`);
      let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, orgId, status: "active" },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { contactId: contact.id, orgId, status: "active" },
        });
      }
      let body = template.bodyText || templateName;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          body = body.replace(`{{${k}}}`, String(v));
        }
      }
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "outbound",
          content: body,
          type: "text",
        },
      });
      return { action, conversationId: conversation.id, sent: true };
    }

    case "add_note": {
      const { contactPhone, content } = payload;
      if (!contactPhone || !content) throw new Error("contactPhone y content requeridos");
      const contact = await prisma.contact.findFirst({ where: { phone: contactPhone, orgId } });
      if (!contact) throw new Error("Contacto no encontrado");
      const note = await prisma.contactNote.create({
        data: { contactId: contact.id, content },
      });
      return { action, noteId: note.id, added: true };
    }

    case "add_tags": {
      const { contactPhone, tags } = payload;
      if (!contactPhone || !tags?.length) throw new Error("contactPhone y tags[] requeridos");
      const contact = await prisma.contact.findFirst({ where: { phone: contactPhone, orgId } });
      if (!contact) throw new Error("Contacto no encontrado");
      await addTagsToContact(contact.id, tags);
      return { action, contactId: contact.id, tags, added: true };
    }

    default:
      throw new Error(`Accion desconocida: ${action}`);
  }
}
