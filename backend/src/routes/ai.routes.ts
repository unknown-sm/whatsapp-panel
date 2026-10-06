import { Router } from "express";
import { listConfigs, createConfig, updateConfig, deleteConfig, setDefault, testGenerate, suggestResponses } from "../controllers/ai.controller";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

// AI config management and test generation are admin only. The list stays
// available to authenticated users (BotEditor picker) but returns masked keys.
router.get("/", listConfigs);
router.post("/", requireAdmin, createConfig);
router.put("/:id", requireAdmin, updateConfig);
router.delete("/:id", requireAdmin, deleteConfig);
router.put("/:id/default", requireAdmin, setDefault);
router.post("/test-generate", requireAdmin, testGenerate);
router.post("/suggest-responses", suggestResponses);

export default router;
