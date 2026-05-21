import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as ctrl from "../controllers/broadcast.controller";

const router = Router();

// Templates
router.get("/templates", authenticate, ctrl.getTemplates);
router.post("/templates", authenticate, requireAdmin, ctrl.createTemplate);
router.patch("/templates/:id", authenticate, requireAdmin, ctrl.updateTemplate);
router.delete("/templates/:id", authenticate, requireAdmin, ctrl.deleteTemplate);

// Broadcasts
router.get("/", authenticate, ctrl.getBroadcasts);
router.post("/", authenticate, requireAdmin, ctrl.createBroadcast);
router.get("/:id", authenticate, ctrl.getBroadcastById);
router.delete("/:id", authenticate, requireAdmin, ctrl.deleteBroadcast);
router.post("/:id/send", authenticate, requireAdmin, ctrl.sendBroadcast);

export default router;
