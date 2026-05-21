import { Router } from "express";
import { listRules, createRule, updateRule, deleteRule, getStats } from "../controllers/followup.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", listRules);
router.post("/", createRule);
router.put("/:id", updateRule);
router.delete("/:id", deleteRule);
router.get("/stats", getStats);

export default router;
