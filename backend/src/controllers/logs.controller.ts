import { Request, Response } from "express";
import * as logsService from "../services/logs.service";

export async function listLogs(req: Request, res: Response) {
  try {
    const result = await logsService.listLogs({
      level: req.query.level as string | undefined,
      source: req.query.source as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export async function clearLogs(req: Request, res: Response) {
  try {
    const days = req.body?.days ? parseInt(req.body.days) : 7;
    const result = await logsService.clearLogs(days);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
