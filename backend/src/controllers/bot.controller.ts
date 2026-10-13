import { Request, Response } from "express";
import * as botService from "../services/bot.service";
import * as flowService from "../services/flow.service";
import * as aiService from "../services/ai.service";
import prisma from "../lib/prisma";
import { z } from "zod";
import { requireOrgId } from "../lib/tenant";

export async function listBots(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const bots = await botService.getAllBots(orgId);
    res.json({ bots });
  } catch {
    res.status(500).json({ error: "Error al obtener bots" });
  }
}

export async function getBot(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const bot = await botService.getBotById(req.params.id, orgId);
    if (!bot) return res.status(404).json({ error: "Bot no encontrado" });
    res.json({ bot });
  } catch {
    res.status(500).json({ error: "Error al obtener bot" });
  }
}

export async function createBot(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const bot = await botService.createBot({ ...req.body, orgId });
    res.status(201).json({ bot });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al crear bot" });
  }
}

export async function updateBot(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const bot = await botService.updateBot(req.params.id, req.body, orgId);
    if (!bot) return res.status(404).json({ error: "Bot no encontrado" });
    res.json({ bot });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al actualizar bot" });
  }
}

export async function deleteBot(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const deleted = await botService.deleteBot(req.params.id, orgId);
    if (!deleted) return res.status(404).json({ error: "Bot no encontrado" });
    res.json({ message: "Bot eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar bot" });
  }
}

export async function addKeyword(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { keyword } = z.object({ keyword: z.string().min(1) }).parse(req.body);
    const kw = await botService.addKeyword(req.params.id, keyword, orgId);
    if (!kw) return res.status(404).json({ error: "Bot no encontrado" });
    res.status(201).json({ keyword: kw });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al agregar keyword" });
  }
}

export async function removeKeyword(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const removed = await botService.removeKeyword(req.params.keywordId, orgId);
    if (!removed) return res.status(404).json({ error: "Keyword no encontrada" });
    res.json({ message: "Keyword eliminada" });
  } catch {
    res.status(500).json({ error: "Error al eliminar keyword" });
  }
}

export async function setDefault(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const bot = await botService.setDefault(req.params.id, orgId);
    if (!bot) return res.status(404).json({ error: "Bot no encontrado" });
    res.json({ bot });
  } catch {
    res.status(500).json({ error: "Error al setear default" });
  }
}

export async function testBot(req: Request, res: Response) {
  try {
    const { message, systemPrompt } = req.body;
    const botId = req.params.id;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    const bot = await botService.getBotById(botId, orgId);
    if (!bot) return res.status(404).json({ error: "Bot no encontrado" });

    const steps = await flowService.getFlowSteps(botId);
    if (!steps.length) return res.status(400).json({ error: "El bot no tiene pasos en su flow" });

    // Find first AI_AGENT step or first step with AI config
    let aiStep = steps.find((s) => s.stepType === "AI_AGENT");
    let configId: string | null = null;

    if (aiStep) {
      const cfg = (aiStep.config as any) || {};
      configId = cfg.configId || null;
    }

    if (!configId) {
      // Fallback: default AI config
      const defaultAI = await prisma.aIConfig.findFirst({ where: { isDefault: true, isActive: true } });
      if (!defaultAI) return res.status(400).json({ error: "No hay configuración de IA default" });
      configId = defaultAI.id;
    }

    // Build conversation history for AI_AGENT
    const messages = [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      ...(bot.systemPrompt ? [{ role: "system" as const, content: bot.systemPrompt }] : []),
      { role: "user" as const, content: message || "Hola" },
    ];

    const response = await aiService.generateResponse(configId!, messages, { botId });
    res.json({ response, botId, botName: bot.name, configId });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Error probando bot" });
  }
}