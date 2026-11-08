import { Router } from "express";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { listEvents, retryEvent } from "../controllers/webhook-event.controller";

const router = Router();
router.use(authMiddleware);

router.get("/", listEvents);
router.post("/:id/retry", requireAdmin, retryEvent);

export default router;
