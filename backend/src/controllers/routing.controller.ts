import { Request, Response } from "express";
import * as routingService from "../services/routing.service";

export async function createRule(req: Request, res: Response) {
  try {
    const rule = await routingService.createRule(req.body);
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getRules(req: Request, res: Response) {
  try {
    const rules = await routingService.getRules();
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateRule(req: Request, res: Response) {
  try {
    const rule = await routingService.updateRule(req.params.id, req.body);
    res.json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteRule(req: Request, res: Response) {
  try {
    await routingService.deleteRule(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
