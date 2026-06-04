import { Request, Response } from "express";
import * as botService from "../services/bot.service";
import { z } from "zod";

export async function listBots(req: Request, res: Response) {
  try {
    const bots = await botService.getAllBots();
    res.json({ bots });
  } catch {
    res.status(500).json({ error: "Error al obtener bots" });
  }
}

export async function getBot(req: Request, res: Response) {
  try {
    const bot = await botService.getBotById(req.params.id);
    if (!bot) return res.status(404).json({ error: "Bot no encontrado" });
    res.json({ bot });
  } catch {
    res.status(500).json({ error: "Error al obtener bot" });
  }
}

export async function createBot(req: Request, res: Response) {
  try {
    const bot = await botService.createBot(req.body);
    res.status(201).json({ bot });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al crear bot" });
  }
}

export async function updateBot(req: Request, res: Response) {
  try {
    const bot = await botService.updateBot(req.params.id, req.body);
    res.json({ bot });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al actualizar bot" });
  }
}

export async function deleteBot(req: Request, res: Response) {
  try {
    await botService.deleteBot(req.params.id);
    res.json({ message: "Bot eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar bot" });
  }
}

export async function addKeyword(req: Request, res: Response) {
  try {
    const { keyword } = z.object({ keyword: z.string().min(1) }).parse(req.body);
    const kw = await botService.addKeyword(req.params.id, keyword);
    res.status(201).json({ keyword: kw });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al agregar keyword" });
  }
}

export async function removeKeyword(req: Request, res: Response) {
  try {
    await botService.removeKeyword(req.params.keywordId);
    res.json({ message: "Keyword eliminada" });
  } catch {
    res.status(500).json({ error: "Error al eliminar keyword" });
  }
}

export async function setDefault(req: Request, res: Response) {
  try {
    const bot = await botService.setDefault(req.params.id);
    res.json({ bot });
  } catch {
    res.status(500).json({ error: "Error al setear default" });
  }
}