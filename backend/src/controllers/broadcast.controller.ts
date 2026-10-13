import { Request, Response } from "express";
import * as broadcastService from "../services/broadcast.service";
import { requireOrgId } from "../lib/tenant";

// ─── Templates ─────────────────────────────────────

export async function createTemplate(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const template = await broadcastService.createTemplate({ ...req.body, orgId });
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getTemplates(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const templates = await broadcastService.getTemplates(orgId);
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateTemplate(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const template = await broadcastService.updateTemplate(req.params.id, req.body, orgId);
    if (!template) return res.status(404).json({ error: "Template no encontrado" });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteTemplate(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const deleted = await broadcastService.deleteTemplate(req.params.id, orgId);
    if (!deleted) return res.status(404).json({ error: "Template no encontrado" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Broadcasts ────────────────────────────────────

export async function createBroadcast(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const broadcast = await broadcastService.createBroadcast({ ...req.body, orgId });
    res.status(201).json(broadcast);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getBroadcasts(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const broadcasts = await broadcastService.getBroadcasts(orgId);
    res.json(broadcasts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getBroadcastById(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const broadcast = await broadcastService.getBroadcastById(req.params.id, orgId);
    if (!broadcast) return res.status(404).json({ error: "Broadcast no encontrado" });
    res.json(broadcast);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteBroadcast(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const deleted = await broadcastService.deleteBroadcast(req.params.id, orgId);
    if (!deleted) return res.status(404).json({ error: "Broadcast no encontrado" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function sendBroadcast(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const broadcast = await broadcastService.sendBroadcast(req.params.id, orgId);
    res.json(broadcast);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
