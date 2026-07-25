import prisma from "../lib/prisma";

export async function getConversations(orgId: string, userId: string) {
  const users = await prisma.user.findMany({
    where: {
      memberships: { some: { orgId } },
      id: { not: userId },
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  // For each user, get last message + unread count
  const result = await Promise.all(
    users.map(async (u) => {
      const lastMsg = await prisma.agentMessage.findFirst({
        where: {
          orgId,
          OR: [
            { senderId: userId, recipientId: u.id },
            { senderId: u.id, recipientId: userId },
            { senderId: u.id, recipientId: null }, // broadcast
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true, createdAt: true, senderId: true, readAt: true },
      });

      const unread = await prisma.agentMessage.count({
        where: {
          orgId,
          senderId: u.id,
          OR: [{ recipientId: userId }, { recipientId: null }],
          readAt: null,
        },
      });

      return {
        user: { id: u.id, name: u.name || u.email, email: u.email, role: u.role },
        lastMessage: lastMsg ? {
          id: lastMsg.id,
          content: lastMsg.content,
          createdAt: lastMsg.createdAt,
          fromMe: lastMsg.senderId === userId,
        } : null,
        unread,
      };
    })
  );

  return result.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt?.getTime() || 0;
    const bTime = b.lastMessage?.createdAt?.getTime() || 0;
    return bTime - aTime;
  });
}

export async function getMessages(orgId: string, userId: string, partnerId: string, limit = 50) {
  return prisma.agentMessage.findMany({
    where: {
      orgId,
      OR: [
        { senderId: userId, recipientId: partnerId },
        { senderId: partnerId, recipientId: userId },
        { senderId: partnerId, recipientId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      senderId: true,
      recipientId: true,
      conversationId: true,
      content: true,
      readAt: true,
      createdAt: true,
      sender: { select: { id: true, name: true } },
      conversation: { select: { id: true, contact: { select: { name: true, phone: true } } } },
    },
  });
}

export async function sendMessage(orgId: string, senderId: string, data: {
  recipientId?: string;
  content: string;
  conversationId?: string;
}) {
  return prisma.agentMessage.create({
    data: {
      orgId,
      senderId,
      recipientId: data.recipientId || null,
      content: data.content,
      conversationId: data.conversationId || null,
    },
    select: {
      id: true,
      senderId: true,
      recipientId: true,
      conversationId: true,
      content: true,
      readAt: true,
      createdAt: true,
      sender: { select: { id: true, name: true } },
      conversation: { select: { id: true, contact: { select: { name: true, phone: true } } } },
    },
  });
}

export async function markRead(orgId: string, userId: string, partnerId: string) {
  return prisma.agentMessage.updateMany({
    where: {
      orgId,
      senderId: partnerId,
      OR: [{ recipientId: userId }, { recipientId: null }],
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}

export async function getUnreadCount(orgId: string, userId: string) {
  return prisma.agentMessage.count({
    where: {
      orgId,
      OR: [{ recipientId: userId }, { recipientId: null }],
      senderId: { not: userId },
      readAt: null,
    },
  });
}
