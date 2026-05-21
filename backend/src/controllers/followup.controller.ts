import { Request, Response } from "express";
import * as followupService from "../services/followup.service";
import { z } from "zod";

export async function listRules(req: Request, res: Response) {
  try {
    const rules = await followupService.getFollowUpRules(req.query.botId as string);
    res.json({ rules });
  } catch {
    res.status(500).json({ error: "Error al obtener reglas" });
  }
}

export async function createRule(req: Request, res: Response) {
  try {
    const rule = await followupService.createFollowUpRule(req.body);
    res.status(201).json({ rule });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al crear regla" });
  }
}

export async function updateRule(req: Request, res: Response) {
  try {
    const rule = await followupService.updateFollowUpRule(req.params.id, req.body);
    res.json({ rule });
  } catch {
    res.status(500).json({ error: "Error al actualizar regla" });
  }
}

export async function deleteRule(req: Request, res: Response) {
  try {
    await followupService.deleteFollowUpRule(req.params.id);
    res.json({ message: "Regla eliminada" });
  } catch {
    res.status(500).json({ error: "Error al eliminar regla" });
  }
}

export async function getStats(req: Request, res: Response) {
  try {
    const stats = await followupService.getFollowUpStats();
    res.json({ stats });
  } catch {
    res.status(500).json({ error: "Error al obtener estadisticas" });
  }
}
