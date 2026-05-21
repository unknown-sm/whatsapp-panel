import { Request, Response } from "express";
import * as pipelineService from "../services/pipeline.service";

// ─── Pipelines ─────────────────────────────────────

export async function createPipeline(req: Request, res: Response) {
  try {
    const pipeline = await pipelineService.createPipeline(req.body);
    res.status(201).json(pipeline);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getPipelines(req: Request, res: Response) {
  try {
    const pipelines = await pipelineService.getPipelines();
    res.json(pipelines);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getPipelineById(req: Request, res: Response) {
  try {
    const pipeline = await pipelineService.getPipelineById(req.params.id);
    if (!pipeline) return res.status(404).json({ error: "Pipeline no encontrado" });
    res.json(pipeline);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updatePipeline(req: Request, res: Response) {
  try {
    const pipeline = await pipelineService.updatePipeline(req.params.id, req.body);
    res.json(pipeline);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deletePipeline(req: Request, res: Response) {
  try {
    await pipelineService.deletePipeline(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Stages ────────────────────────────────────────

export async function createStage(req: Request, res: Response) {
  try {
    const stage = await pipelineService.createStage(req.body);
    res.status(201).json(stage);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateStage(req: Request, res: Response) {
  try {
    const stage = await pipelineService.updateStage(req.params.id, req.body);
    res.json(stage);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteStage(req: Request, res: Response) {
  try {
    await pipelineService.deleteStage(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Deals ─────────────────────────────────────────

export async function createDeal(req: Request, res: Response) {
  try {
    const deal = await pipelineService.createDeal(req.body);
    res.status(201).json(deal);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getDeals(req: Request, res: Response) {
  try {
    const deals = await pipelineService.getDeals(req.query as any);
    res.json(deals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getDealById(req: Request, res: Response) {
  try {
    const deal = await pipelineService.getDealById(req.params.id);
    if (!deal) return res.status(404).json({ error: "Deal no encontrado" });
    res.json(deal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateDeal(req: Request, res: Response) {
  try {
    const deal = await pipelineService.updateDeal(req.params.id, req.body);
    res.json(deal);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function moveDeal(req: Request, res: Response) {
  try {
    const { dealId, stageId } = req.body;
    const deal = await pipelineService.moveDeal(dealId, stageId);
    res.json(deal);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteDeal(req: Request, res: Response) {
  try {
    await pipelineService.deleteDeal(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Stats ─────────────────────────────────────────

export async function getRevenueSummary(req: Request, res: Response) {
  try {
    const summary = await pipelineService.getRevenueSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getPipelineStats(req: Request, res: Response) {
  try {
    const stats = await pipelineService.getPipelineStats(req.params.id);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
