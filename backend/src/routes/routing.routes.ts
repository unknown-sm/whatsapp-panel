import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as routingController from "../controllers/routing.controller";

const router = Router();

router.post("/", authenticate, requireAdmin, routingController.createRule);
router.get("/", authenticate, routingController.getRules);
router.put("/:id", authenticate, requireAdmin, routingController.updateRule);
router.delete("/:id", authenticate, requireAdmin, routingController.deleteRule);

export default router;
