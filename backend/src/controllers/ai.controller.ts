import { Request, Response } from "express";
import * as aiService from "../services/ai.service";
import { z } from "zod";

export async function listConfigs(req: Request, res: Response) {
  try {
    const configs = await aiService.getAIConfigs();
    res.json({ configs });
  } catch {
    res.status(500).json({ error: "Error al obtener configs" });
  }
}

export async function createConfig(req: Request, res: Response) {
  try {
    const config = await aiService.createAIConfig(req.body);
    res.status(201).json({ config });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al crear config" });
  }
}

export async function updateConfig(req: Request, res: Response) {
  try {
    const config = await aiService.updateAIConfig(req.params.id, req.body);
    res.json({ config });
  } catch {
    res.status(500).json({ error: "Error al actualizar config" });
  }
}

export async function deleteConfig(req: Request, res: Response) {
  try {
    await aiService.deleteAIConfig(req.params.id);
    res.json({ message: "Config eliminada" });
  } catch {
    res.status(500).json({ error: "Error al eliminar config" });
  }
}

export async function setDefault(req: Request, res: Response) {
  try {
    const config = await aiService.setDefault(req.params.id);
    res.json({ config });
  } catch {
    res.status(500).json({ error: "Error al setear default" });
  }
}

export async function testGenerate(req: Request, res: Response) {
  try {
    const { configId, messages, systemPrompt, maxTokens } = req.body;
    if (!configId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "configId y messages[] requeridos" });
    }
    const response = await aiService.generateResponse(configId, messages, { systemPrompt, maxTokens });
    res.json({ response });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Error generando respuesta" });
  }
}

export async function suggestResponses(req: Request, res: Response) {
  try {
    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ error: "conversationId requerido" });
    const result = await aiService.suggestResponses(conversationId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Error generando sugerencias" });
  }
}
