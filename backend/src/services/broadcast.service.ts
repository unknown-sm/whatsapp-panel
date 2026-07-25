import prisma from "../lib/prisma";
import { sendWhatsAppMessage } from "./whatsapp.service";

// ─── Templates ─────────────────────────────────────

export async function createTemplate(data: { name: string; content: string; variables?: string[]; orgId?: string }) {
  return prisma.broadcastTemplate.create({
    data: {
      name: data.name,
      content: data.content,
      variables: data.variables || [],
      orgId: data.orgId || null,
    },
  });
}

export async function getTemplates(orgId?: string) {
  const where: any = { isActive: true };
  if (orgId) where.orgId = orgId;
  return prisma.broadcastTemplate.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function updateTemplate(id: string, data: Partial<{ name: string; content: string; variables: string[]; isActive: boolean }>) {
  return prisma.broadcastTemplate.update({ where: { id }, data });
}

export async function deleteTemplate(id: string) {
  return prisma.broadcastTemplate.update({ where: { id }, data: { isActive: false } });
}

// ─── Broadcasts ────────────────────────────────────

export async function createBroadcast(data: {
  name: string;
  templateId?: string;
  content: string;
  scheduledAt?: string;
  filters?: any;
  orgId?: string;
}) {
  return prisma.broadcast.create({
    data: {
      name: data.name,
      templateId: data.templateId || null,
      content: data.content,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      filters: data.filters || {},
      status: data.scheduledAt ? "SCHEDULED" : "DRAFT",
      orgId: data.orgId || null,
    },
    include: { template: true },
  });
}

export async function getBroadcasts(orgId?: string) {
  const where: any = {};
  if (orgId) where.orgId = orgId;
  return prisma.broadcast.findMany({
    where,
    include: { template: true, _count: { select: { recipients: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBroadcastById(id: string, orgId?: string) {
  return prisma.broadcast.findFirst({
    where: { id, ...(orgId ? { orgId } : {}) },
    include: {
      template: true,
      recipients: { include: { contact: true } },
    },
  });
}

export async function deleteBroadcast(id: string) {
  return prisma.broadcast.delete({ where: { id } });
}

// ─── Send Broadcast ────────────────────────────────

export async function sendBroadcast(broadcastId: string) {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: { template: true },
  });

  if (!broadcast) throw new Error("Broadcast no encontrado");
  if (broadcast.status === "SENT" || broadcast.status === "SENDING") {
    throw new Error("Broadcast ya fue enviado");
  }

  // Get contacts
  const filters = broadcast.filters as any || {};
  let where: any = {};

  if (filters.tags && filters.tags.length > 0) {
    where.tags = { some: { tag: { name: { in: filters.tags } } } };
  }

  // If minScore filter, get qualified IDs first (SQL), then fetch only those contacts
  let contacts;
  if (filters.minScore && filters.minScore > 0) {
    const scores = await prisma.leadScore.groupBy({
      by: ["contactId"],
      _sum: { points: true },
      having: { points: { _sum: { gte: filters.minScore } } },
    });
    const qualifiedIds = scores.map((s) => s.contactId);
    if (qualifiedIds.length === 0) {
      throw new Error("No hay contactos que cumplan el filtro de score");
    }
    where.id = { in: qualifiedIds };
  }

  contacts = await prisma.contact.findMany({
    where,
    include: { tags: { include: { tag: true } } },
  });

  if (contacts.length === 0) {
    throw new Error("No hay contactos que cumplan los filtros");
  }

  // Update status
  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "SENDING", totalCount: contacts.length },
  });

  // Create recipients
  await prisma.broadcastRecipient.createMany({
    data: contacts.map((c) => ({
      broadcastId,
      contactId: c.id,
      status: "pending",
    })),
    skipDuplicates: true,
  });

  // Send messages
  let sentCount = 0;
  let failedCount = 0;

  for (const contact of contacts) {
    const message = broadcast.content;
    const success = await sendWhatsAppMessage(contact.phone, message);

    await prisma.broadcastRecipient.updateMany({
      where: { broadcastId, contactId: contact.id },
      data: {
        status: success ? "sent" : "failed",
        sentAt: success ? new Date() : null,
        error: success ? null : "Error al enviar",
      },
    });

    if (success) sentCount++;
    else failedCount++;
  }

  // Update broadcast
  const finalBroadcast = await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      status: failedCount > 0 && sentCount === 0 ? "FAILED" : "SENT",
      sentAt: new Date(),
      sentCount,
      failedCount,
    },
    include: { template: true },
  });

  return finalBroadcast;
}

// ─── Cron: Check scheduled broadcasts ──────────────

export async function checkScheduledBroadcasts() {
  const now = new Date();
  const scheduled = await prisma.broadcast.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
  });

  for (const broadcast of scheduled) {
    try {
      await sendBroadcast(broadcast.id);
      console.log(`Broadcast enviado: ${broadcast.name}`);
    } catch (err: any) {
      console.error(`Error enviando broadcast ${broadcast.name}:`, err.message);
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { status: "FAILED" },
      });
    }
  }

  return scheduled.length;
}
