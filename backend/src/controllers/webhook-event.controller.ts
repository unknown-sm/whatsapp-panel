import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { listWebhookEvents, processWebhookEvent, retryWebhookEvent } from "../services/webhook-event.service";

export async function listEvents(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.orgId) return res.status(400).json({ error: "Usuario sin organización" });
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const events = await listWebhookEvents(req.user.orgId, status, limit);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function retryEvent(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.orgId) return res.status(400).json({ error: "Usuario sin organización" });
    const event = await retryWebhookEvent(req.params.id, req.user.orgId);
    if (!event) return res.status(404).json({ error: "Evento no encontrado" });
    setImmediate(() => processWebhookEvent(event.id).catch((err) => console.error("[WEBHOOK-EVENT] Retry error:", err)));
    res.json({ success: true, event });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
