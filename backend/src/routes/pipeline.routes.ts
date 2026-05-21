import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as ctrl from "../controllers/pipeline.controller";

const router = Router();

// Pipelines
router.get("/", authenticate, ctrl.getPipelines);
router.post("/", authenticate, requireAdmin, ctrl.createPipeline);
router.get("/:id", authenticate, ctrl.getPipelineById);
router.patch("/:id", authenticate, requireAdmin, ctrl.updatePipeline);
router.delete("/:id", authenticate, requireAdmin, ctrl.deletePipeline);
router.get("/:id/stats", authenticate, ctrl.getPipelineStats);
router.get("/revenue/summary", authenticate, ctrl.getRevenueSummary);

// Stages
router.post("/stages", authenticate, requireAdmin, ctrl.createStage);
router.patch("/stages/:id", authenticate, requireAdmin, ctrl.updateStage);
router.delete("/stages/:id", authenticate, requireAdmin, ctrl.deleteStage);

// Deals
router.get("/deals/all", authenticate, ctrl.getDeals);
router.post("/deals", authenticate, ctrl.createDeal);
router.get("/deals/:id", authenticate, ctrl.getDealById);
router.patch("/deals/:id", authenticate, ctrl.updateDeal);
router.delete("/deals/:id", authenticate, ctrl.deleteDeal);
router.post("/deals/move", authenticate, ctrl.moveDeal);

export default router;
