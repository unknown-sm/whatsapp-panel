import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as ctrl from "../controllers/webhook.controller";

const router = Router();

// Trigger endpoint (called by n8n — no JWT auth, uses secret key)
router.post("/trigger", ctrl.trigger);

// Internal admin endpoints (for frontend settings page)
router.get("/config", authenticate, requireAdmin, ctrl.getConfig);
router.put("/config", authenticate, requireAdmin, ctrl.setConfig);
router.post("/regenerate-secret", authenticate, requireAdmin, ctrl.regenerateSecret);

export default router;
