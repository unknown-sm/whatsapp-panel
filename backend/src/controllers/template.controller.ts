import { Request, Response } from "express";
import * as templateService from "../services/template.service";
import { authenticate, requireAdmin } from "../middleware/auth";
import { requireOrgId } from "../lib/tenant";

export async function listTemplates(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const templates = await templateService.listTemplates(orgId);
    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listApproved(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const templates = await templateService.listApprovedTemplates(orgId);
    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getTemplate(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const t = await templateService.getTemplate(req.params.id, orgId);
    if (!t) return res.status(404).json({ error: "Template no encontrado" });
    res.json({ template: t });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createTemplate(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const t = await templateService.createTemplate({ ...req.body, orgId });
    res.status(201).json({ template: t });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateTemplate(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const t = await templateService.updateTemplate(req.params.id, req.body, orgId);
    if (!t) return res.status(404).json({ error: "Template no encontrado" });
    res.json({ template: t });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteTemplate(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const deleted = await templateService.deleteTemplate(req.params.id, orgId);
    if (!deleted) return res.status(404).json({ error: "Template no encontrado" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function syncWithMeta(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const result = await templateService.syncWithMeta(orgId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function sendTemplate(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { phone, templateId, variables } = req.body;
    if (!phone || !templateId) return res.status(400).json({ error: "phone y templateId requeridos" });
    const result = await templateService.sendTemplate(phone, templateId, variables || [], orgId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}