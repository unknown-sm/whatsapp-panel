import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { processIncomingMessage } from "./whatsapp.service";

export const WEBHOOK_MAX_ATTEMPTS = 5;
const STUCK_PROCESSING_MS = 2 * 60 * 1000;

export function webhookEventKey(rawBody: Buffer | string): string {
  return `sha256:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
}

export function extractPhoneNumberId(payload: any): string | null {
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const id = change?.value?.metadata?.phone_number_id;
      if (typeof id === "string" && id) return id;
    }
  }
  return null;
}

export function retryDelayMs(attempts: number): number {
  return Math.min(5 * 60 * 1000, 5000 * 2 ** Math.max(0, attempts - 1));
}

async function resolveOrganizationId(phoneNumberId: string | null, db: any = prisma): Promise<string | null> {
  if (!phoneNumberId) return null;
  const config = await db.whatsappConfig.findUnique({
    where: { phoneNumberId },
    select: { id: true, orgId: true },
  });
  if (!config) return null;
  if (config.orgId) return config.orgId;

  // Backfill único para instalaciones anteriores a orgId. Después de esto la
  // ingesta siempre usa la organización dueña del phoneNumberId.
  const firstOrg = await db.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!firstOrg) return null;
  await db.whatsappConfig.update({ where: { id: config.id }, data: { orgId: firstOrg.id } });
  return firstOrg.id;
}

export async function enqueueWebhookEvent(input: { payload: any; rawBody: Buffer }, db: any = prisma) {
  const phoneNumberId = extractPhoneNumberId(input.payload);
  const orgId = await resolveOrganizationId(phoneNumberId, db);
  const eventKey = webhookEventKey(input.rawBody);

  try {
    const event = await db.webhookEvent.create({
      data: {
        eventKey,
        phoneNumberId,
        orgId,
        payload: input.payload as Prisma.InputJsonValue,
        status: "pending",
      },
    });
    return { event, isNew: true };
  } catch (err: any) {
    // Dos entregas simultáneas pueden pasar el controller a la vez. La única
    // autoridad es el UNIQUE de eventKey: quien pierde la carrera reutiliza la fila.
    if (err?.code !== "P2002") throw err;
    const event = await db.webhookEvent.findUnique({ where: { eventKey } });
    if (!event) throw err;
    return { event, isNew: false };
  }
}

interface ProcessDependencies {
  db?: any;
  processPayload?: (payload: any, orgId?: string) => Promise<void>;
}

export async function processWebhookEvent(eventId: string, deps: ProcessDependencies = {}) {
  const db = deps.db || prisma;
  const processPayload = deps.processPayload || processIncomingMessage;

  // Claim atómico: otro worker no puede procesar la misma fila simultáneamente.
  const claimed = await db.webhookEvent.updateMany({
    where: {
      id: eventId,
      status: "pending",
      attempts: { lt: WEBHOOK_MAX_ATTEMPTS },
      nextRetryAt: { lte: new Date() },
    },
    data: {
      status: "processing",
      attempts: { increment: 1 },
      lastError: null,
    },
  });
  if (claimed.count !== 1) return { processed: false, reason: "not_claimable" as const };

  const event = await db.webhookEvent.findUnique({ where: { id: eventId } });
  if (!event) return { processed: false, reason: "not_found" as const };

  try {
    if (!event.orgId) throw new Error("No se pudo asociar el evento a una organización");
    await processPayload(event.payload, event.orgId);
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { status: "done", processedAt: new Date(), lastError: null, nextRetryAt: new Date() },
    });
    return { processed: true, status: "done" as const, attempts: event.attempts };
  } catch (err: any) {
    const message = String(err?.message || err || "Error desconocido").slice(0, 2000);
    const terminal = event.attempts >= WEBHOOK_MAX_ATTEMPTS;
    const nextRetryAt = new Date(Date.now() + retryDelayMs(event.attempts));
    await db.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: terminal ? "failed" : "pending",
        lastError: message,
        nextRetryAt,
      },
    });
    console.error(`[WEBHOOK-EVENT] ${event.id} intento ${event.attempts}/${WEBHOOK_MAX_ATTEMPTS}: ${message}`);
    return { processed: false, status: terminal ? "failed" as const : "pending" as const, attempts: event.attempts };
  }
}

export async function recoverStuckWebhookEvents(db: any = prisma) {
  const result = await db.webhookEvent.updateMany({
    where: { status: "processing", updatedAt: { lt: new Date(Date.now() - STUCK_PROCESSING_MS) } },
    data: { status: "pending", nextRetryAt: new Date(), lastError: "Worker interrumpido; evento recuperado" },
  });
  return result.count as number;
}

export async function runPendingWebhookEvents(limit = 20) {
  await recoverStuckWebhookEvents();
  const events = await prisma.webhookEvent.findMany({
    where: { status: "pending", attempts: { lt: WEBHOOK_MAX_ATTEMPTS }, nextRetryAt: { lte: new Date() } },
    orderBy: { receivedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const event of events) await processWebhookEvent(event.id);
  return events.length;
}

export async function listWebhookEvents(orgId: string, status?: string, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, limit));
  return prisma.webhookEvent.findMany({
    where: { orgId, ...(status ? { status } : {}) },
    orderBy: { receivedAt: "desc" },
    take: safeLimit,
    select: {
      id: true,
      phoneNumberId: true,
      status: true,
      attempts: true,
      nextRetryAt: true,
      lastError: true,
      receivedAt: true,
      processedAt: true,
    },
  });
}

export async function retryWebhookEvent(id: string, orgId: string) {
  const existing = await prisma.webhookEvent.findFirst({ where: { id, orgId } });
  if (!existing) return null;
  return prisma.webhookEvent.update({
    where: { id },
    data: { status: "pending", attempts: 0, nextRetryAt: new Date(), lastError: null, processedAt: null },
  });
}
