import { Router } from "express";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import {
  getConfig,
  saveConfig,
  testConnection,
  getOpenwaStatus,
  getQrCode,
  startSession,
  resetConnection,
  setupWebhook,
} from "../controllers/openwa.controller";

const router = Router();
// OpenWA admin operations: config, QR (session takeover), reset — admin only
router.use(authMiddleware, requireAdmin);

router.get("/config", getConfig);
router.put("/config", saveConfig);
router.post("/test", testConnection);
router.get("/status", getOpenwaStatus);
router.get("/qr", getQrCode);
router.post("/session/start", startSession);
router.post("/session/reset", resetConnection);
router.post("/webhook/setup", setupWebhook);

export default router;
