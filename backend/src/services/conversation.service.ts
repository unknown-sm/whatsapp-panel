import prisma from "../lib/prisma";
import { z } from "zod";

export async function getConversations(filters: { status?: string; botId?: string; agentId?: string; search?: string; page?: number; pageSize?: number; orgId?: string }) {
  const where: any = {};
  if (filters.orgId) where.orgId = filters.orgId;
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

export async function getConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      contact: { include: { tags: { include: { tag: true } }, notes: { include: { agent: true } } } },
      bot: true,
      assignedAgent: true,
      messages: { orderBy: { timestamp: "asc" } },
    },
  });
}

export async function sendMessage(conversationId: string, content: string, direction: "inbound" | "outbound" = "outbound") {
  const message = await prisma.message.create({
    data: { conversationId, direction, type: "text", content },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

export async function assignAgent(conversationId: string, agentId: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedAgentId: agentId, status: "active" },
    include: { assignedAgent: true },
  });
}

export async function updateStatus(conversationId: string, status: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { status },
  });
}

export async function addNote(contactId: string, content: string, agentId?: string) {
  return prisma.contactNote.create({
    data: { contactId, content, agentId },
    include: { agent: true },
  });
}

export async function addTag(contactId: string, tagId: string) {
  return prisma.contactTags.create({ data: { contactId, tagId } });
}

export async function removeTag(contactId: string, tagId: string) {
  return prisma.contactTags.delete({ where: { contactId_tagId: { contactId, tagId } } });
}

export async function getContacts(search?: string, page?: number, pageSize?: number) {
  const where: any = {};
  if (search) {
    where.OR = [
      { phone: { contains: search } },
      { name: { contains: search } },
    ];
  }

  const p = Math.max(1, page || 1);
  const ps = Math.min(100, Math.max(1, pageSize || 50));
  const skip = (p - 1) * ps;

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
        _count: { select: { conversations: true } },
      },
      orderBy: { lastActivity: "desc" },
      skip,
      take: ps,
    }),
    prisma.contact.count({ where }),
  ]);

  return {
    contacts,
    pagination: { page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) },
  };
}

export async function exportContacts() {
  const contacts = await prisma.contact.findMany({
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: "desc" },
  });

  return contacts.map((c) => ({
    phone: c.phone,
    name: c.name || "",
    firstContact: c.firstContact.toISOString(),
    lastActivity: c.lastActivity.toISOString(),
    tags: c.tags.map((ct) => ct.tag.name).join(", "),
  }));
}
