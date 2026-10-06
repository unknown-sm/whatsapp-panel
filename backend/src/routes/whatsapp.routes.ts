import { Router } from "express";
import { webhookVerify, webhookIncoming, getStatus, testConnection, updateConfig } from "../controllers/whatsapp.controller";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();

// Public webhook endpoints (no auth required for Meta, signature verified in controller)
router.get("/", webhookVerify);
router.post("/", webhookIncoming);

// Protected API endpoints
router.get("/status", authMiddleware, getStatus);
router.post("/test", authMiddleware, requireAdmin, testConnection);
router.put("/config", authMiddleware, requireAdmin, updateConfig);

export default router;
