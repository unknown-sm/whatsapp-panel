import { Router } from "express";
import { webhookVerify, webhookIncoming, getStatus, testConnection, updateConfig } from "../controllers/whatsapp.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public webhook endpoints (no auth required for Meta)
router.get("/verify", webhookVerify);
router.post("/incoming", webhookIncoming);

// Protected API endpoints
router.get("/status", authMiddleware, getStatus);
router.post("/test", authMiddleware, testConnection);
router.put("/config", authMiddleware, updateConfig);

export default router;
