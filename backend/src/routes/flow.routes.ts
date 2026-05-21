import { Router } from "express";
import { listSteps, createStep, updateStep, deleteStep, reorderSteps, addIntentRoute, removeIntentRoute } from "../controllers/flow.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/:botId/steps", listSteps);
router.post("/:botId/steps", createStep);
router.put("/:botId/steps/:stepId", updateStep);
router.delete("/:botId/steps/:stepId", deleteStep);
router.post("/:botId/steps/reorder", reorderSteps);
router.post("/:botId/steps/:stepId/intents", addIntentRoute);
router.delete("/:botId/steps/:stepId/intents/:routeId", removeIntentRoute);

export default router;
