import { Request, Response } from "express";
import * as pipelineService from "../services/pipeline.service";
import { addScoreByCondition } from "../services/leadscore.service";

function getOrgId(req: Request): string | undefined {
  return (req as any).user?.orgId;
}

// ─── Pipelines ─────────────────────────────────────

export async function createPipeline(req: Request, res: Response) {
  try {
    const pipeline = await pipelineService.createPipeline(req.body, getOrgId(req));
    res.status(201).json(pipeline);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getPipelines(req: Request, res: Response) {
  try {
    const pipelines = await pipelineService.getPipelines(getOrgId(req));
    res.json(pipelines);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getPipelineById(req: Request, res: Response) {
  try {
    const pipeline = await pipelineService.getPipelineById(req.params.id, getOrgId(req));
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
    const data = { ...req.body, orgId: getOrgId(req) };
    const deal = await pipelineService.createDeal(data);

    // Lead scoring: DEAL_CREATED
    if (deal.contactId) {
      addScoreByCondition(deal.contactId, "DEAL_CREATED", `Deal creado: ${deal.name}`).catch(() => {});
    }

    res.status(201).json(deal);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getDeals(req: Request, res: Response) {
  try {
    const deals = await pipelineService.getDeals(req.query as any, getOrgId(req));
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

    // Lead scoring: DEAL_WON
    if (deal.status === "WON" && deal.contactId) {
      addScoreByCondition(deal.contactId, "DEAL_WON", `Deal ganado: ${deal.name}`).catch(() => {});
    }

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
