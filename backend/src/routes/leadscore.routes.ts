import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as ctrl from "../controllers/leadscore.controller";

const router = Router();

router.get("/rules", authenticate, ctrl.getRules);
router.post("/rules", authenticate, requireAdmin, ctrl.createRule);
router.patch("/rules/:id", authenticate, requireAdmin, ctrl.updateRule);
router.delete("/rules/:id", authenticate, requireAdmin, ctrl.deleteRule);

router.get("/leaderboard", authenticate, ctrl.getLeaderboard);
router.post("/recalculate", authenticate, requireAdmin, ctrl.recalculateScores);
router.get("/contact/:contactId", authenticate, ctrl.getContactScores);

export default router;
