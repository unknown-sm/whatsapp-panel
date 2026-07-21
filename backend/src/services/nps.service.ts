import prisma from "../lib/prisma";
import * as metaOAuth from "./meta-oauth.service";
import { decrypt, isEncrypted } from "./crypto.service";

/* ── NPS scoring ─────────────────────────────── */

export function classifyNps(score: number): { category: "detractor" | "passive" | "promoter"; npsScore: number } {
  let category: "detractor" | "passive" | "promoter";
  if (score <= 6) category = "detractor";
  else if (score <= 8) category = "passive";
  else category = "promoter";

  // NPS = % promoters - % detractors (will be computed at aggregation)
  return { category, npsScore: score };
}

/* ── Send NPS question to contact ───────────────── */

export async function sendNpsToContact(campaignId: string, contactId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contacto no encontrado");

  const campaign = await prisma.npsCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campana no encontrada");

  // Create pending response
  const response = await prisma.npsResponse.create({
    data: {
      campaignId: campaign.id,
      contactId: contact.id,
      sentAt: new Date(),
    },
  });

  // Build NPS question message
  const message = `Hola ${contact.name || ""}! 😊\n\nGracias por confiar en nosotros. En una escala del 0 al 10, que tan probable es que nos recomiendes?\n\nResponde con un numero del 0 al 10. Tu opinion nos ayuda a mejorar.`;

  // Try Meta first
  const config = await prisma.whatsappConfig.findFirst();
  if (config) {
    const accessToken = isEncrypted(config.accessToken) ? decrypt(config.accessToken) : config.accessToken;
    try {
      const axios = (await import("axios")).default;
      await axios.post(
        `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: contact.phone,
          type: "text",
          text: { body: message },
        },
        { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.error("NPS send error:", err.response?.data || err.message);
    }
  }

  return response;
}

/* ── Receive NPS response (called when contact replies with a number) ───── */

export async function recordNpsResponse(contactId: string, message: string): Promise<{ recorded: boolean; responseId?: string }> {
  // Detect if message is a number 0-10
  const trimmed = message.trim();
  const score = parseInt(trimmed);
  if (isNaN(score) || score < 0 || score > 10) {
    return { recorded: false };
  }

  // Find the most recent pending response for this contact
  const pending = await prisma.npsResponse.findFirst({
    where: { contactId, score: null, respondedAt: null },
    orderBy: { sentAt: "desc" },
  });
  if (!pending) {
    // No pending NPS — record as spontaneous
    const created = await prisma.npsResponse.create({
      data: { contactId, score, respondedAt: new Date() },
    });
    return { recorded: true, responseId: created.id };
  }

  await prisma.npsResponse.update({
    where: { id: pending.id },
    data: { score, respondedAt: new Date() },
  });
  return { recorded: true, responseId: pending.id };
}

/* ── Stats: NPS score and breakdown ─────────────── */

export async function getNpsStats(days: number = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const responses = await prisma.npsResponse.findMany({
    where: { score: { not: null }, respondedAt: { gte: startDate } },
  });

  const total = responses.length;
  if (total === 0) {
    return { totalResponses: 0, promoters: 0, passives: 0, detractors: 0, npsScore: 0 };
  }

  const promoters = responses.filter((r) => (r.score || 0) >= 9).length;
  const passives = responses.filter((r) => (r.score || 0) >= 7 && (r.score || 0) <= 8).length;
  const detractors = responses.filter((r) => (r.score || 0) <= 6).length;

  const npsScore = Math.round(((promoters - detractors) / total) * 100);

  // Distribution
  const distribution: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
  for (const r of responses) {
    if (r.score !== null) distribution[r.score] = (distribution[r.score] || 0) + 1;
  }

  return {
    totalResponses: total,
    promoters,
    passives,
    detractors,
    npsScore,
    distribution,
  };
}

/* ── Campaigns CRUD ──────────────────────────── */

export async function getCampaigns() {
  return prisma.npsCampaign.findMany({
    include: { _count: { select: { responses: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCampaign(data: { name: string; templateId?: string; triggerType?: string; delayHours?: number }) {
  return prisma.npsCampaign.create({
    data: {
      name: data.name,
      templateId: data.templateId,
      triggerType: data.triggerType || "manual",
      delayHours: data.delayHours || 24,
    },
  });
}

export async function toggleCampaign(id: string, isActive: boolean) {
  return prisma.npsCampaign.update({ where: { id }, data: { isActive } });
}

export async function deleteCampaign(id: string) {
  return prisma.npsCampaign.delete({ where: { id } });
}

/* ── Send NPS to all contacts (manual trigger) ──── */

export async function sendCampaignNow(campaignId: string) {
  const campaign = await prisma.npsCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campana no encontrada");

  // Get all contacts (or filter by tag if specified in template)
  const contacts = await prisma.contact.findMany({ take: 100, orderBy: { lastActivity: "desc" } });

  let sent = 0;
  for (const contact of contacts) {
    // Skip if already responded to this campaign
    const existing = await prisma.npsResponse.findFirst({
      where: { campaignId, contactId: contact.id },
    });
    if (existing) continue;

    await sendNpsToContact(campaignId, contact.id);
    sent++;
  }
  return { sent, total: contacts.length };
}