import prisma from "../lib/prisma";

const WINDOW_HOURS = 24;

export async function trackInbound(contactId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  return prisma.conversationWindow.upsert({
    where: { contactId },
    create: {
      contactId,
      lastInboundAt: now,
      windowExpiresAt: expiresAt,
      isOpen: true,
      messageCount: 1,
    },
    update: {
      lastInboundAt: now,
      windowExpiresAt: expiresAt,
      isOpen: true,
      messageCount: { increment: 1 },
    },
  });
}

export async function isWindowOpen(contactId: string): Promise<boolean> {
  const window = await prisma.conversationWindow.findUnique({
    where: { contactId },
  });

  if (!window) return false;

  // Auto-close if expired
  if (window.windowExpiresAt < new Date()) {
    await prisma.conversationWindow.update({
      where: { contactId },
      data: { isOpen: false },
    });
    return false;
  }

  return window.isOpen;
}

export async function getWindow(contactId: string) {
  return prisma.conversationWindow.findUnique({
    where: { contactId },
  });
}

export async function closeWindow(contactId: string) {
  return prisma.conversationWindow.update({
    where: { contactId },
    data: { isOpen: false },
  });
}

export async function setCategory(contactId: string, category: string) {
  return prisma.conversationWindow.update({
    where: { contactId },
    data: { lastCategory: category },
  });
}

export async function addCost(contactId: string, cost: number) {
  return prisma.conversationWindow.update({
    where: { contactId },
    data: { totalCost: { increment: cost } },
  });
}

export async function getOpenWindows() {
  return prisma.conversationWindow.findMany({
    where: {
      isOpen: true,
      windowExpiresAt: { gt: new Date() },
    },
    include: { contact: { select: { id: true, phone: true, name: true } } },
  });
}

export async function getExpiringWindows(withinHours: number = 2) {
  const cutoff = new Date(Date.now() + withinHours * 60 * 60 * 1000);
  return prisma.conversationWindow.findMany({
    where: {
      isOpen: true,
      windowExpiresAt: { lt: cutoff, gt: new Date() },
    },
    include: { contact: { select: { id: true, phone: true, name: true } } },
  });
}

// Check if we can send free-form message or need template
export async function canSendFreeForm(contactId: string): Promise<{
  allowed: boolean;
  reason: string;
  expiresAt?: Date;
}> {
  const window = await prisma.conversationWindow.findUnique({
    where: { contactId },
  });

  if (!window) {
    return { allowed: false, reason: "no_window" };
  }

  if (!window.isOpen || window.windowExpiresAt < new Date()) {
    return { allowed: false, reason: "window_closed" };
  }

  return {
    allowed: true,
    reason: "window_open",
    expiresAt: window.windowExpiresAt,
  };
}

// Cleanup expired windows (run periodically)
export async function cleanupExpiredWindows() {
  const result = await prisma.conversationWindow.updateMany({
    where: {
      isOpen: true,
      windowExpiresAt: { lt: new Date() },
    },
    data: { isOpen: false },
  });
  return result.count;
}
