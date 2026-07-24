import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as ctrl from "../controllers/analytics.controller";

const router = Router();

router.get("/messages-over-time", authenticate, ctrl.getMessagesOverTime);
router.get("/conversations-by-bot", authenticate, ctrl.getConversationsByBot);
router.get("/contact-growth", authenticate, ctrl.getContactGrowth);
router.get("/deal-funnel", authenticate, ctrl.getDealFunnel);
router.get("/top-bots", authenticate, ctrl.getTopBots);
router.get("/overview", authenticate, ctrl.getOverviewStats);
router.get("/revenue-source", authenticate, ctrl.getRevenueBySource);
router.get("/agent-performance", authenticate, ctrl.getAgentPerformance);
router.get("/forecast", authenticate, ctrl.getForecast);

export default router;
