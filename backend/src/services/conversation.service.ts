import prisma from "../lib/prisma";
import { z } from "zod";

export async function getConversations(filters: { status?: string; botId?: string; agentId?: string; search?: string; page?: number; pageSize?: number; orgId: string }) {
  const where: any = { orgId: filters.orgId };
  if (filters.status) where.status = filters.status;
  if (filters.botId) where.botId = filters.botId;
  if (filters.agentId) where.assignedAgentId = filters.agentId;
  if (filters.search) {
    where.contact = { phone: { contains: filters.search } };
  }

  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        contact: true,
        bot: { select: { name: true } },
        assignedAgent: { select: { name: true, email: true } },
        messages: { orderBy: { timestamp: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.conversation.count({ where }),
  ]);

  return {
    conversations,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getConversation(id: string, orgId: string) {
  return prisma.conversation.findFirst({
    where: { id, orgId },
    include: {
      contact: { include: { tags: { include: { tag: true } }, notes: { include: { agent: true } } } },
      bot: true,
      assignedAgent: true,
      messages: { orderBy: { timestamp: "asc" } },
    },
  });
}

export async function sendMessage(conversationId: string, content: string, direction: "inbound" | "outbound" = "outbound", agentId?: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: { select: { id: true, phone: true } } },
  });
  if (!conv) throw new Error("Conversación no encontrada");

  if (direction === "outbound") {
    // Gate de la ventana de 24h de Meta: texto libre solo con ventana abierta
    const { canSendFreeForm, trackOutbound } = await import("./session.service");
    const window = await canSendFreeForm(conv.contact.id);
    if (!window.allowed) {
      const err: any = new Error("WINDOW_CLOSED");
      err.code = "WINDOW_CLOSED";
      throw err;
    }
    const { resolveEngine } = await import("./whatsapp-engine");
    const sent = await resolveEngine().sendText(conv.contact.phone, content);
    if (!sent) throw new Error("Meta rechazó el envío del mensaje");
    trackOutbound(conv.contact.id).catch(() => {});
  }

  const message = await prisma.message.create({
    data: { conversationId, direction, type: "text", content },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      updatedAt: new Date(),
      // Un humano escribió: el bot deja de responder esta conversación.
      // Además, si nadie estaba asignado, el agente que escribió queda asignado.
      ...(direction === "outbound"
        ? { humanTakeover: true, ...(agentId && !conv.assignedAgentId ? { assignedAgentId: agentId } : {}) }
        : {}),
    },
  });

  // Reprogramar follow-ups a partir de esta actividad
  if (direction === "outbound") {
    import("./followup.service").then((m) => m.refreshFollowUpSchedule(conversationId)).catch(() => {});
  }

  return message;
}

export async function assignAgent(conversationId: string, agentId: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    // Transferir a un humano frena el bot (humanTakeover) aunque el botId siga puesto
    data: { assignedAgentId: agentId, status: "active", humanTakeover: true },
    include: { assignedAgent: true },
  });
}

/**
 * Reinicia la memoria del bot para pruebas: el flujo vuelve al paso 0, se
 * libera el control humano y la IA solo "ve" los mensajes posteriores al reset
 * (memoryResetAt). Los mensajes NO se borran del historial visible del CRM.
 */
export async function resetBotMemory(conversationId: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: "active",
      humanTakeover: false,
      currentStepId: null,
      silencedUntil: null,
      contextVars: { currentStepIndex: 0, memoryResetAt: new Date().toISOString() },
    },
  });
}

export async function updateStatus(conversationId: string, status: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    // "active" reactiva el bot: es la forma de devolverle la conversación.
    // "closed" también libera el takeover (el próximo inbound crea conversación nueva).
    data: { status, ...(status === "active" || status === "closed" ? { humanTakeover: false } : {}) },
  });
}

export async function addNote(contactId: string, content: string, agentId?: string) {
  return prisma.contactNote.create({
    where: undefined as any,
    data: {},
  });
}
