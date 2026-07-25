import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import * as service from "../services/agent-chat.service";

function requireAuth(req: AuthRequest) {
  if (!req.user?.id || !req.user?.orgId) throw new Error("Se requiere autenticacion");
  return { userId: req.user.id, orgId: req.user.orgId };
}

export async function getConversations(req: AuthRequest, res: Response) {
  try {
    const { userId, orgId } = requireAuth(req);
    const convs = await service.getConversations(orgId, userId);
    res.json(convs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getMessages(req: AuthRequest, res: Response) {
  try {
    const { userId, orgId } = requireAuth(req);
    const msgs = await service.getMessages(orgId, userId, req.params.partnerId);
    // Automatically mark as read
    await service.markRead(orgId, userId, req.params.partnerId);
    res.json(msgs.reverse());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { userId, orgId } = requireAuth(req);
    const msg = await service.sendMessage(orgId, userId, req.body);
    res.status(201).json(msg);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    const { userId, orgId } = requireAuth(req);
    const count = await service.getUnreadCount(orgId, userId);
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
