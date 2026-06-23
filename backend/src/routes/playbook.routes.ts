import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as playbookController from "../controllers/playbook.controller";

const router = Router();

// Playbooks
router.post("/", authenticate, requireAdmin, playbookController.createPlaybook);
router.get("/", authenticate, playbookController.getPlaybooks);
router.get("/:id", authenticate, playbookController.getPlaybook);
router.put("/:id", authenticate, requireAdmin, playbookController.updatePlaybook);
router.delete("/:id", authenticate, requireAdmin, playbookController.deletePlaybook);
router.put("/:id/default", authenticate, requireAdmin, playbookController.setDefault);

// Stages
router.put("/stages/:stageId", authenticate, requireAdmin, playbookController.updateStage);
router.delete("/stages/:stageId", authenticate, requireAdmin, playbookController.deleteStage);

// A/B Tests
router.post("/tests", authenticate, requireAdmin, playbookController.createABTest);
router.get("/tests", authenticate, playbookController.getABTests);
router.get("/tests/:testId", authenticate, playbookController.getTestResults);
router.post("/tests/:testId/complete", authenticate, requireAdmin, playbookController.completeTest);

export default router;
