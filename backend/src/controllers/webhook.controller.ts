import { Request, Response } from "express";
import * as service from "../services/webhook.service";
import { AuthRequest } from "../middleware/auth";

// ═══════════════════════════════════════════════════════════
// PUBLIC — called by n8n
// ═══════════════════════════════════════════════════════════

export async function trigger(req: Request, res: Response) {
  try {
    const { orgId, secret, action, payload } = req.body;
    if (!orgId || !secret || !action || !payload) {
      return res.status(400).json({ error: "orgId, secret, action y payload requeridos" });
    }
    const result = await service.triggerWebhook(orgId, secret, action, payload);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(err.message.includes("no encontrado") || err.message.includes("no configurado") ? 404 : 401).json({ error: err.message });
  }
}

function requireUser(req: AuthRequest) {
  if (!req.user?.orgId) throw new Error("Se requiere autenticacion con organizacion");
  return req.user.orgId;
}

// ═══════════════════════════════════════════════════════════
// ADMIN — manage webhook config
// ═══════════════════════════════════════════════════════════

export async function getConfig(req: AuthRequest, res: Response) {
  try {
    const orgId = requireUser(req);
    const config = await service.getConfig(orgId);
    if (!config) return res.json({ configured: false });
    res.json({ configured: true, ...config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function setConfig(req: AuthRequest, res: Response) {
  try {
    const orgId = requireUser(req);
    const result = await service.setConfig(orgId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function regenerateSecret(req: AuthRequest, res: Response) {
  try {
    const orgId = requireUser(req);
    const secret = await service.regenerateSecret(orgId);
    res.json({ secret });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
