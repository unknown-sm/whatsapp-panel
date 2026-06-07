import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
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
router.use(authMiddleware);

router.get("/config", getConfig);
router.put("/config", saveConfig);
router.post("/test", testConnection);
router.get("/status", getOpenwaStatus);
router.get("/qr", getQrCode);
router.post("/session/start", startSession);
router.post("/session/reset", resetConnection);
router.post("/webhook/setup", setupWebhook);

export default router;
