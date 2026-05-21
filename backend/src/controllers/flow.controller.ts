import { Request, Response } from "express";
import * as flowService from "../services/flow.service";
import { z } from "zod";

export async function listSteps(req: Request, res: Response) {
  try {
    const steps = await flowService.getFlowSteps(req.params.botId);
    res.json({ steps });
  } catch {
    res.status(500).json({ error: "Error al obtener pasos" });
  }
}

export async function createStep(req: Request, res: Response) {
  try {
    const step = await flowService.createStep(req.params.botId, req.body);
    res.status(201).json({ step });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al crear paso" });
  }
}

export async function updateStep(req: Request, res: Response) {
  try {
    const step = await flowService.updateStep(req.params.stepId, req.body);
    res.json({ step });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al actualizar paso" });
  }
}

export async function deleteStep(req: Request, res: Response) {
  try {
    await flowService.deleteStep(req.params.stepId);
    res.json({ message: "Paso eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar paso" });
  }
}

export async function reorderSteps(req: Request, res: Response) {
  try {
    const { stepIds } = z.object({ stepIds: z.array(z.string().uuid()) }).parse(req.body);
    await flowService.reorderSteps(req.params.botId, stepIds);
    res.json({ message: "Orden actualizado" });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al reordenar" });
  }
}

export async function addIntentRoute(req: Request, res: Response) {
  try {
    const { label, samples, nextStepId } = z.object({
      label: z.string().min(1),
      samples: z.array(z.string()),
      nextStepId: z.string().uuid().optional(),
    }).parse(req.body);
    const route = await flowService.addIntentRoute(req.params.stepId, label, samples, nextStepId);
    res.status(201).json({ route });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al agregar ruta" });
  }
}

export async function removeIntentRoute(req: Request, res: Response) {
  try {
    await flowService.removeIntentRoute(req.params.routeId);
    res.json({ message: "Ruta eliminada" });
  } catch {
    res.status(500).json({ error: "Error al eliminar ruta" });
  }
}
