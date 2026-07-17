import { Request, Response } from "express";
import * as labService from "../services/lab.service";
import prisma from "../lib/prisma";

export async function getPersonas(req: Request, res: Response) {
  res.json({ personas: labService.LAB_PERSONAS });
}

export async function createRun(req: Request, res: Response) {
  try {
    const { personaIds } = req.body as { personaIds: string[] };
    if (!personaIds || !Array.isArray(personaIds) || personaIds.length === 0) {
      return res.status(400).json({ error: "personaIds[] requerido" });
    }

    const config = await prisma.aIConfig.findFirst({
      where: { isActive: true, isDefault: true },
    });
    if (!config) return res.status(400).json({ error: "No hay AI config default configurada" });

    const userId = (req as any).user?.id;
    const run = await labService.createRun({ personaIds, configId: config.id, userId });

    // Execute async (don't block response)
    labService.executeRun(run.id, personaIds, config.id).catch((err) => {
      console.error("Lab run error:", err);
    });

    res.status(201).json({ runId: run.id, status: "running" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRun(req: Request, res: Response) {
  try {
    const run = await labService.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: "Run no encontrado" });
    res.json({ run });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRecentRuns(req: Request, res: Response) {
  try {
    const runs = await labService.getRecentRuns(20);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function applySuggestion(req: Request, res: Response) {
  try {
    const { caseId, hallazgoIndex, botId } = req.body;
    const result = await labService.applySuggestionToKB(caseId, hallazgoIndex, botId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}