import prisma from "../lib/prisma";
import { z } from "zod";
import { sendWhatsAppMessage } from "./whatsapp.service";
import { sendTemplate } from "./template.service";
import { isBlacklisted } from "./blacklist.service";
import { addScoreByCondition } from "./leadscore.service";
import { canSendFreeForm, trackOutbound } from "./session.service";
import { getIo } from "../lib/socket";

export async function getFollowUpRules(botId?: string, orgId?: string) {
  const where: any = {};
  if (botId) where.botId = botId;
  if (orgId) where.orgId = orgId;
  return prisma.followUpRule.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function createFollowUpRule(data: any) {
  const parsed = z.object({
    botId: z.string().uuid(),
    stepId: z.string().uuid().optional(),
    delayHours: z.number().int().min(1),
    maxAttempts: z.number().int().min(1).max(5).default(3),
    message: z.string().min(1),
    templateId: z.string().uuid().optional(),
    isActive: z.boolean().default(true),
    orgId: z.string().optional(),
  }).parse(data);

  return prisma.followUpRule.create({ data: parsed });
}

export async function updateFollowUpRule(id: string, data: any) {
  return prisma.followUpRule.update({ where: { id }, data });
}

export async function deleteFollowUpRule(id: string) {
  return prisma.followUpRule.delete({ where: { id } });
}

export async function getFollowUpStats() {
  const rules = await prisma.followUpRule.findMany({ include: { bot: true } });
  const stats = [];

  for (const rule of rules) {
    const attempts = await prisma.followUpAttempt.count({ where: { ruleId: rule.id } });
    const replied = await prisma.followUpAttempt.count({ where: { ruleId: rule.id, replied: true } });
    stats.push({
      ruleId: rule.id,
      botName: rule.bot.name,
      totalAttempts: attempts,
      reEngaged: replied,
      rate: attempts > 0 ? Math.round((replied / attempts) * 100) : 0,
    });
  }

  return stats;
}

/**
 * Recalcula `nextFollowUpDueAt` de una conversación tras cualquier actividad
 * (inbound/outbound/asignación de bot). El cron luego solo consulta las filas
 * vencidas (`nextFollowUpDueAt <= now`) en vez de escanear todas las activas.
 */
export async function refreshFollowUpSchedule(conversationId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, botId: true, status: true },
  });
  if (!conv) return;

  if (conv.status !== "active" || !conv.botId) {
    await prisma.conversation.update({ where: { id: conv.id }, data: { nextFollowUpDueAt: null } });
    return;
  }

  // La regla más corta define el primer vencimiento
  const rule = await prisma.followUpRule.findFirst({
    where: { botId: conv.botId, isActive: true },
    orderBy: { delayHours: "asc" },
  });

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { nextFollowUpDueAt: rule ? new Date(Date.now() + rule.delayHours * 60 * 60 * 1000) : null },
  });
}

// Cron job: procesa SOLO los follow-ups vencidos (índice sobre nextFollowUpDueAt)
export async function checkFollowUps() {
  const now = new Date();
  const conversations = await prisma.conversation.findMany({
    where: { status: "active", nextFollowUpDueAt: { lte: now } },
    include: {
      contact: true,
      followUpAttempts: true,
    },
  });

  for (const conv of conversations) {
    try {
      const rules = await prisma.followUpRule.findMany({
        where: { botId: conv.botId!, isActive: true },
        orderBy: { delayHours: "asc" },
      });

      // Elegir la primera regla que aún tiene intentos disponibles
      const rule = rules.find((r) => conv.followUpAttempts.filter((a) => a.ruleId === r.id).length < r.maxAttempts);

      if (!rule) {
        // Sin intentos disponibles: pasa a agente y no se reprograma
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { status: "waiting_agent", nextFollowUpDueAt: null },
        });
        getIo().emit("conversation:updated", { id: conv.id, status: "waiting_agent" });
        continue;
      }

      if (await isBlacklisted(conv.contactId)) {
        await prisma.conversation.update({ where: { id: conv.id }, data: { nextFollowUpDueAt: null } });
        continue;
      }

      const attemptCount = conv.followUpAttempts.filter((a) => a.ruleId === rule.id).length;
      const window = await canSendFreeForm(conv.contactId);

      let sent = false;
      let status = "sent";
      let content = rule.message;

      if (window.allowed) {
        // Ventana de 24h abierta: texto libre
        sent = await sendWhatsAppMessage(conv.contact.phone, rule.message);
        if (sent) trackOutbound(conv.contactId).catch(() => {});
      } else if (rule.templateId && conv.orgId) {
        // Ventana cerrada: solo template aprobado (gratis si hay FEP activo)
        try {
          await sendTemplate(conv.contact.phone, rule.templateId, [], conv.orgId);
          sent = true;
          content = `[template] ${rule.templateId}`;
          trackOutbound(conv.contactId).catch(() => {});
        } catch {
          sent = false;
        }
      } else {
        // Ventana cerrada y sin template configurado: no se puede escribir (Meta 131047).
        // Se registra el intento para cortar el reintento en bucle y se pasa a agente.
        status = "skipped_window_closed";
      }

      if (!sent && status === "sent") status = "failed";

      await prisma.followUpAttempt.create({
        data: {
          conversationId: conv.id,
          ruleId: rule.id,
          attemptNumber: attemptCount + 1,
          status,
        },
      });

      if (sent) {
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            direction: "outbound",
            type: "text",
            content,
          },
        });

        getIo().emit("message:new", {
          conversationId: conv.id,
          content,
          direction: "outbound",
          timestamp: new Date().toISOString(),
        });
        // Lead scoring: MESSAGE_SENT
        addScoreByCondition(conv.orgId || "", conv.contactId, "MESSAGE_SENT", "Follow-up enviado").catch(() => {});
      }

      // Reprogramar o terminar: si fue el último intento o se saltó por ventana
      // cerrada sin template, la conversación pasa a waiting_agent.
      const exhausted = attemptCount + 1 >= rule.maxAttempts || status === "skipped_window_closed";
      await prisma.conversation.update({
        where: { id: conv.id },
        data: exhausted
          ? { status: "waiting_agent", nextFollowUpDueAt: null }
          : { nextFollowUpDueAt: new Date(Date.now() + rule.delayHours * 60 * 60 * 1000) },
      });
      if (exhausted) {
        getIo().emit("conversation:updated", { id: conv.id, status: "waiting_agent" });
      }
    } catch (err) {
      console.error(`Follow-up error en conversación ${conv.id}:`, err);
    }
  }
}
