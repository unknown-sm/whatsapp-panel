import { Router } from "express";
import { listLogs, clearLogs } from "../controllers/logs.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", listLogs);
router.delete("/", clearLogs);

export default router;
