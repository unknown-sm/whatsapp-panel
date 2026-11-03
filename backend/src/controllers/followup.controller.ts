import { Request, Response } from "express";
import * as followupService from "../services/followup.service";
import { z } from "zod";

function getOrgId(req: Request): string | undefined {
  return (req as any).user?.orgId;
}

export async function listRules(req: Request, res: Response) {
  try {
    const rules = await followupService.getFollowUpRules(req.query.botId as string, getOrgId(req));
    res.json({ rules });
  } catch {
    res.status(500).json({ error: "Error al obtener reglas" });
  }
}

export async function createRule(req: Request, res: Response) {
  try {
    const data = { ...req.body, orgId: getOrgId(req) };
    const rule = await followupService.createFollowUpRule(data);
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

// Dry-run: que haria el cron ahora mismo (sin enviar nada) y por que,
// explicado en terminos de las politicas de Meta.
export async function preview(req: Request, res: Response) {
  try {
    const result = await followupService.previewFollowUps(getOrgId(req));
    res.json(result);
  } catch (error) {
    console.error("Follow-up preview error:", error);
    res.status(500).json({ error: "Error al simular seguimientos" });
  }
}

// Ejecuta el ciclo de seguimientos ahora (para testing sin esperar al cron).
export async function runNow(req: Request, res: Response) {
  try {
    await followupService.checkFollowUps();
    res.json({ message: "Ciclo de seguimientos ejecutado" });
  } catch (error) {
    console.error("Follow-up run-now error:", error);
    res.status(500).json({ error: "Error al ejecutar seguimientos" });
  }
}
