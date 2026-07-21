import { Request, Response } from "express";
import * as npsService from "../services/nps.service";
import { authenticate } from "../middleware/auth";

const router = (require("express").Router)();
router.use(authenticate);

router.get("/campaigns", async (req: Request, res: Response) => {
  try {
    const campaigns = await npsService.getCampaigns();
    res.json({ campaigns });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/campaigns", async (req: Request, res: Response) => {
  try {
    const campaign = await npsService.createCampaign(req.body);
    res.status(201).json({ campaign });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/campaigns/:id/toggle", async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    const campaign = await npsService.toggleCampaign(req.params.id, isActive);
    res.json({ campaign });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/campaigns/:id", async (req: Request, res: Response) => {
  try {
    await npsService.deleteCampaign(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/campaigns/:id/send", async (req: Request, res: Response) => {
  try {
    const result = await npsService.sendCampaignNow(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const stats = await npsService.getNpsStats(days);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
export default router;
