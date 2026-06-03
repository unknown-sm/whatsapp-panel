import { Request, Response } from "express";
import * as knowledgeService from "../services/knowledge.service";

export async function listKnowledge(req: Request, res: Response) {
  try {
    const entries = await knowledgeService.getBotKnowledge(req.params.botId);
    res.json({ entries });
  } catch {
    res.status(500).json({ error: "Error al obtener conocimiento" });
  }
}

export async function uploadKnowledge(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: "Archivo requerido" });
    const entry = await knowledgeService.addKnowledge(req.params.botId, req.file);
    res.status(201).json({ entry });
  } catch {
    res.status(500).json({ error: "Error al subir archivo" });
  }
}

export async function deleteKnowledge(req: Request, res: Response) {
  try {
    await knowledgeService.deleteKnowledge(req.params.id);
    res.json({ message: "Archivo eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar archivo" });
  }
}
