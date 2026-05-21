import { Request, Response } from "express";
import * as customFieldService from "../services/customfield.service";

export async function createCustomField(req: Request, res: Response) {
  try {
    const field = await customFieldService.createCustomField(req.body);
    res.status(201).json(field);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getCustomFields(req: Request, res: Response) {
  try {
    const fields = await customFieldService.getCustomFields(req.query.entityType as string);
    res.json(fields);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateCustomField(req: Request, res: Response) {
  try {
    const field = await customFieldService.updateCustomField(req.params.id, req.body);
    res.json(field);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteCustomField(req: Request, res: Response) {
  try {
    await customFieldService.deleteCustomField(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function setCustomFieldValue(req: Request, res: Response) {
  try {
    const value = await customFieldService.setCustomFieldValue(req.body);
    res.json(value);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getContactCustomValues(req: Request, res: Response) {
  try {
    const values = await customFieldService.getContactCustomValues(req.params.contactId);
    res.json(values);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
