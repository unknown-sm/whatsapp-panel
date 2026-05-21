import { Request, Response } from "express";
import * as broadcastService from "../services/broadcast.service";

// ─── Templates ─────────────────────────────────────

export async function createTemplate(req: Request, res: Response) {
  try {
    const template = await broadcastService.createTemplate(req.body);
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getTemplates(req: Request, res: Response) {
  try {
    const templates = await broadcastService.getTemplates();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateTemplate(req: Request, res: Response) {
  try {
    const template = await broadcastService.updateTemplate(req.params.id, req.body);
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteTemplate(req: Request, res: Response) {
  try {
    await broadcastService.deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Broadcasts ────────────────────────────────────

export async function createBroadcast(req: Request, res: Response) {
  try {
    const broadcast = await broadcastService.createBroadcast(req.body);
    res.status(201).json(broadcast);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getBroadcasts(req: Request, res: Response) {
  try {
    const broadcasts = await broadcastService.getBroadcasts();
    res.json(broadcasts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getBroadcastById(req: Request, res: Response) {
  try {
    const broadcast = await broadcastService.getBroadcastById(req.params.id);
    if (!broadcast) return res.status(404).json({ error: "Broadcast no encontrado" });
    res.json(broadcast);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteBroadcast(req: Request, res: Response) {
  try {
    await broadcastService.deleteBroadcast(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function sendBroadcast(req: Request, res: Response) {
  try {
    const broadcast = await broadcastService.sendBroadcast(req.params.id);
    res.json(broadcast);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
