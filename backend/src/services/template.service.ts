import prisma from "../lib/prisma";
import axios from "axios";
import { decrypt, isEncrypted } from "./crypto.service";

/* ── List / Get ─────────────────────────────────────── */

export async function listTemplates() {
  return prisma.messageTemplate.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getTemplate(id: string) {
  return prisma.messageTemplate.findUnique({ where: { id } });
}

export async function listApprovedTemplates() {
  return prisma.messageTemplate.findMany({
    where: { status: "APPROVED" },
    orderBy: { name: "asc" },
  });
}

/* ── CRUD ────────────────────────────────────────────── */

export async function createTemplate(data: {
  name: string;
  category: string;
  language?: string;
  bodyText: string;
  headerType?: string;
  headerText?: string;
  footerText?: string;
  variables?: any;
  buttons?: any;
}) {
  return prisma.messageTemplate.create({
    data: {
      name: data.name,
      category: data.category,
      language: data.language || "es",
      bodyText: data.bodyText,
      headerType: data.headerType,
      headerText: data.headerText,
      footerText: data.footerText,
      variables: data.variables as any,
      buttons: data.buttons as any,
      status: "PENDING",
    },
  });
}

export async function updateTemplate(id: string, data: Partial<{
  name: string;
  category: string;
  bodyText: string;
  status: string;
  metaTemplateId: string;
  qualityRating: string;
}> & Record<string, any>) {
  return prisma.messageTemplate.update({ where: { id }, data });
}

export async function deleteTemplate(id: string) {
  return prisma.messageTemplate.delete({ where: { id } });
}

/* ── Meta Sync ───────────────────────────────────────── */

export async function syncWithMeta() {
  const config = await prisma.whatsappConfig.findFirst();
  if (!config) {
    throw new Error("WhatsApp no configurado");
  }

  const accessToken = isEncrypted(config.accessToken) ? decrypt(config.accessToken) : config.accessToken;

  // Call Meta Graph API to list templates
  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/message_templates`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { limit: 100 },
  });

  const remoteTemplates = res.data.data || [];
  let synced = 0;
  let created = 0;

  for (const t of remoteTemplates) {
    const status = (t.status || "PENDING").toUpperCase();
    const qualityScore = t.quality_score?.score || null;

    const existing = await prisma.messageTemplate.findFirst({
      where: { name: t.name, language: t.language },
    });

    if (existing) {
      await prisma.messageTemplate.update({
        where: { id: existing.id },
        data: {
          status: status as any,
          qualityRating: qualityScore as any,
          lastQualityUpdate: new Date(),
          metaTemplateId: t.id,
        },
      });
      synced++;
    } else {
      await prisma.messageTemplate.create({
        data: {
          name: t.name,
          category: t.category || "UTILITY",
          language: t.language || "es",
          bodyText: t.components?.find((c: any) => c.type === "BODY")?.text || "",
          headerType: t.components?.find((c: any) => c.type === "HEADER")?.format,
          headerText: t.components?.find((c: any) => c.type === "HEADER")?.text,
          footerText: t.components?.find((c: any) => c.type === "FOOTER")?.text,
          status: status as any,
          qualityRating: qualityScore as any,
          lastQualityUpdate: new Date(),
          metaTemplateId: t.id,
        },
      });
      created++;
    }
  }

  return { synced, created, total: remoteTemplates.length };
}

/* ── Send template (reopen 24h window) ──────────────── */

export async function sendTemplate(phone: string, templateId: string, variables: string[] = []) {
  const config = await prisma.whatsappConfig.findFirst();
  if (!config) throw new Error("WhatsApp no configurado");

  const accessToken = isEncrypted(config.accessToken) ? decrypt(config.accessToken) : config.accessToken;

  const template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new Error("Template no encontrado");
  if (template.status !== "APPROVED") throw new Error("Template no aprobado");

  const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
  const body: any = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
    },
  };

  // Add variables if provided
  if (variables.length > 0) {
    const components = variables.map((v, i) => ({
      type: "body",
      parameters: [{ type: "text", text: v }],
    }));
    body.template.components = components;
  }

  const res = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return res.data;
}