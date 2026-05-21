import { Request, Response } from "express";
import * as leadScoreService from "../services/leadscore.service";

export async function createRule(req: Request, res: Response) {
  try {
    const rule = await leadScoreService.createRule(req.body);
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getRules(req: Request, res: Response) {
  try {
    const rules = await leadScoreService.getRules();
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateRule(req: Request, res: Response) {
  try {
    const rule = await leadScoreService.updateRule(req.params.id, req.body);
    res.json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteRule(req: Request, res: Response) {
  try {
    await leadScoreService.deleteRule(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getLeaderboard(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const leaderboard = await leadScoreService.getLeaderboard(limit);
    res.json(leaderboard);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function recalculateScores(req: Request, res: Response) {
  try {
    const count = await leadScoreService.recalculateScores();
    res.json({ recalculated: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getContactScores(req: Request, res: Response) {
  try {
    const scores = await leadScoreService.getContactScores(req.params.contactId);
    res.json(scores);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
