import { Request, Response } from "express";
import * as knowledgeService from "../services/knowledge.service";

// El router se monta en /api/bots/:botId/knowledge (conocimiento del bot +
// global) y en /api/knowledge (solo global). Sin botId => global.
function botIdOf(req: Request): string | null {
  return req.params.botId || null;
}

export async function listKnowledge(req: Request, res: Response) {
  try {
    const entries = await knowledgeService.getBotKnowledge(botIdOf(req));
    res.json({ entries });
  } catch {
    res.status(500).json({ error: "Error al obtener conocimiento" });
  }
}

export async function uploadKnowledge(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: "Archivo requerido" });
    const entry = await knowledgeService.addKnowledge(botIdOf(req), req.file);
    res.status(201).json({ entry });
  } catch {
    res.status(500).json({ error: "Error al subir archivo" });
  }
}

export async function importUrlKnowledge(req: Request, res: Response) {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") return res.status(400).json({ error: "url requerida" });
    const entry = await knowledgeService.addKnowledgeFromUrl(botIdOf(req), url.trim());
    res.status(201).json({ entry });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "No se pudo importar la pagina" });
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
