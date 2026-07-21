import { Request, Response } from "express";
import * as reportsService from "../services/reports.service";
import { authenticate } from "../middleware/auth";

const router = (require("express").Router)();
router.use(authenticate);

router.get("/recent", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const reports = await reportsService.getRecentReports(limit);
    res.json({ reports });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const report = await reportsService.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: "Reporte no encontrado" });
    res.json({ report });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const period = (req.body.period || "daily") as "daily" | "weekly" | "monthly";
    const report = await reportsService.saveReport(period);
    res.json({ report });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/preview/daily", async (req: Request, res: Response) => {
  try {
    const { data, periodStart, periodEnd } = await reportsService.generateReport("daily");
    res.json({ data, periodStart, periodEnd, text: reportsService.formatReportText(data, periodStart, periodEnd) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
export default router;
