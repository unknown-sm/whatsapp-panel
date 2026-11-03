import { Router } from "express";
import { listRules, createRule, updateRule, deleteRule, getStats, preview, runNow } from "../controllers/followup.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", listRules);
router.post("/", createRule);
router.get("/stats", getStats);
router.get("/preview", preview);
router.post("/run-now", runNow);
router.put("/:id", updateRule);
router.delete("/:id", deleteRule);

export default router;
