import { Request, Response } from "express";
import * as analyticsService from "../services/analytics.service";

export async function getMessagesOverTime(req: Request, res: Response) {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await analyticsService.getMessagesOverTime(days);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getConversationsByBot(req: Request, res: Response) {
  try {
    const data = await analyticsService.getConversationsByBot();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getContactGrowth(req: Request, res: Response) {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await analyticsService.getContactGrowth(days);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getDealFunnel(req: Request, res: Response) {
  try {
    const data = await analyticsService.getDealFunnel(req.query.pipelineId as string);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getTopBots(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const data = await analyticsService.getTopBots(limit);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getOverviewStats(req: Request, res: Response) {
  try {
    const data = await analyticsService.getOverviewStats();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
