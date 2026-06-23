import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import * as pushService from "../services/push.service";

const router = Router();

router.get("/vapid-key", (req: Request, res: Response) => {
  res.json({ publicKey: pushService.getVapidPublicKey() });
});

router.post("/subscribe", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { endpoint, keys } = req.body;
    await pushService.saveSubscription(userId, { endpoint, keys });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/unsubscribe", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const key = `push_sub_${userId}`;
    const prisma = (await import("../lib/prisma")).default;
    await prisma.setting.delete({ where: { key } }).catch(() => {});
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
