import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import * as leadScoreService from "../services/leadscore.service";

function getOrg(req: AuthRequest): string {
  if (!req.user?.orgId) throw new Error("No autorizado");
  return req.user.orgId;
}

export async function createRule(req: AuthRequest, res: Response) {
  try {
    const rule = await leadScoreService.createRule({ ...req.body, orgId: getOrg(req) });
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getRules(req: AuthRequest, res: Response) {
  try {
    const rules = await leadScoreService.getRules(getOrg(req));
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateRule(req: AuthRequest, res: Response) {
  try {
    const rule = await leadScoreService.updateRule(getOrg(req), req.params.id, req.body);
    res.json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteRule(req: AuthRequest, res: Response) {
  try {
    await leadScoreService.deleteRule(getOrg(req), req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getLeaderboard(req: AuthRequest, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const leaderboard = await leadScoreService.getLeaderboard(getOrg(req), limit);
    res.json(leaderboard);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function recalculateScores(req: AuthRequest, res: Response) {
  try {
    const count = await leadScoreService.recalculateScores(getOrg(req));
    res.json({ recalculated: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getContactScores(req: AuthRequest, res: Response) {
  try {
    const scores = await leadScoreService.getContactScores(req.params.contactId, getOrg(req));
    res.json(scores);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
