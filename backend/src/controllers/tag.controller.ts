import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import prisma from "../lib/prisma";

export async function getTags(req: Request, res: Response) {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
    res.json(tags);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
}

export async function createTag(req: Request, res: Response) {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: "name requerido" });
    const tag = await prisma.tag.create({ data: { name, color: color || "#3B82F6" } });
    res.status(201).json(tag);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function updateTag(req: Request, res: Response) {
  try {
    const { name, color } = req.body;
    const tag = await prisma.tag.update({ where: { id: req.params.id }, data: { ...(name ? { name } : {}), ...(color ? { color } : {}) } });
    res.json(tag);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function deleteTag(req: Request, res: Response) {
  try {
    await prisma.tag.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function assignTag(req: AuthRequest, res: Response) {
  try {
    const { contactId, tagId } = req.body;
    await prisma.contactTags.create({ data: { contactId, tagId } });
    res.json({ ok: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function removeTag(req: AuthRequest, res: Response) {
  try {
    const { contactId, tagId } = req.body;
    await prisma.contactTags.delete({ where: { contactId_tagId: { contactId, tagId } } });
    res.json({ ok: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
}

export async function getContactTags(req: Request, res: Response) {
  try {
    const tags = await prisma.contactTags.findMany({
      where: { contactId: req.params.contactId },
      include: { tag: true },
    });
    res.json(tags.map(t => t.tag));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
}
