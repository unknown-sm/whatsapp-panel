import prisma from "../lib/prisma";

const WINDOW_HOURS = 24;
const FEP_REPLY_WINDOW_HOURS = 24; // hay 24h para responder y ganar el FEP
const FEP_DURATION_HOURS = 72;     // el FEP dura 72h desde la primera respuesta

export async function trackInbound(contactId: string, opts?: { fromAd?: boolean }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);
  // Si el mensaje viene de un anuncio (CTWA), se abre el plazo de 24h para
  // responder y ganar la ventana gratuita de 72h (Free Entry Point).
  const fepDeadline = opts?.fromAd
    ? new Date(now.getTime() + FEP_REPLY_WINDOW_HOURS * 60 * 60 * 1000)
    : undefined;

  return prisma.conversationWindow.upsert({
    where: { contactId },
    create: {
      contactId,
      lastInboundAt: now,
      windowExpiresAt: expiresAt,
      isOpen: true,
      messageCount: 1,
      fepReplyDeadline: fepDeadline ?? null,
    },
    update: {
      lastInboundAt: now,
      windowExpiresAt: expiresAt,
      isOpen: true,
      messageCount: { increment: 1 },
      ...(fepDeadline ? { fepReplyDeadline: fepDeadline } : {}),
    },
  });
}

/**
 * Registrar mensaje saliente: si el último inbound fue de un anuncio y la
 * respuesta llega dentro de las 24h, se gana el FEP (72h de mensajes gratis,
 * incluidos templates, contados desde esta respuesta).
 */
export async function trackOutbound(contactId: string) {
  const now = new Date();
  const w = await prisma.conversationWindow.findUnique({ where: { contactId } });
  if (!w) return null;
  if (w.fepReplyDeadline && !w.freeEntryPointUntil && now <= w.fepReplyDeadline) {
    return prisma.conversationWindow.update({
      where: { contactId },
      data: { freeEntryPointUntil: new Date(now.getTime() + FEP_DURATION_HOURS * 60 * 60 * 1000) },
    });
  }
  return w;
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
  /** true si el contacto está dentro del Free Entry Point de 72h (CTWA): templates sin cargo */
  freeEntryPointActive?: boolean;
  freeEntryPointUntil?: Date;
}> {
  const window = await prisma.conversationWindow.findUnique({
    where: { contactId },
  });

  if (!window) {
    return { allowed: false, reason: "no_window" };
  }

  const now = new Date();
  const fepActive = !!window.freeEntryPointUntil && window.freeEntryPointUntil > now;

  if (!window.isOpen || window.windowExpiresAt < now) {
    return {
      allowed: false,
      reason: "window_closed",
      freeEntryPointActive: fepActive,
      freeEntryPointUntil: window.freeEntryPointUntil ?? undefined,
    };
  }

  return {
    allowed: true,
    reason: "window_open",
    expiresAt: window.windowExpiresAt,
    freeEntryPointActive: fepActive,
    freeEntryPointUntil: window.freeEntryPointUntil ?? undefined,
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
