import { Request, Response } from "express";
import * as playbookService from "../services/playbook.service";

// ─── Playbooks ─────────────────────────────────────

export async function createPlaybook(req: Request, res: Response) {
  try {
    const playbook = await playbookService.createPlaybook(req.body);
    res.status(201).json(playbook);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getPlaybooks(req: Request, res: Response) {
  try {
    const playbooks = await playbookService.getPlaybooks();
    res.json(playbooks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getPlaybook(req: Request, res: Response) {
  try {
    const playbook = await playbookService.getPlaybook(req.params.id);
    if (!playbook) return res.status(404).json({ error: "Playbook no encontrado" });
    res.json(playbook);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updatePlaybook(req: Request, res: Response) {
  try {
    const playbook = await playbookService.updatePlaybook(req.params.id, req.body);
    res.json(playbook);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deletePlaybook(req: Request, res: Response) {
  try {
    await playbookService.deletePlaybook(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function setDefault(req: Request, res: Response) {
  try {
    const playbook = await playbookService.setDefaultPlaybook(req.params.id);
    res.json(playbook);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── Stages ────────────────────────────────────────

export async function updateStage(req: Request, res: Response) {
  try {
    const stage = await playbookService.updateStage(req.params.stageId, req.body);
    res.json(stage);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteStage(req: Request, res: Response) {
  try {
    await playbookService.deleteStage(req.params.stageId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ─── A/B Tests ─────────────────────────────────────

export async function createABTest(req: Request, res: Response) {
  try {
    const test = await playbookService.createABTest(req.body);
    res.status(201).json(test);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getABTests(req: Request, res: Response) {
  try {
    const tests = await playbookService.getABTests();
    res.json(tests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getTestResults(req: Request, res: Response) {
  try {
    const results = await playbookService.getTestResults(req.params.testId);
    if (!results) return res.status(404).json({ error: "Test no encontrado" });
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function completeTest(req: Request, res: Response) {
  try {
    const test = await playbookService.completeTest(req.params.testId);
    res.json(test);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
