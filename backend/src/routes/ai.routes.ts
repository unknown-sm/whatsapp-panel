import { Router } from "express";
import { listConfigs, createConfig, updateConfig, deleteConfig, setDefault, testGenerate, suggestResponses } from "../controllers/ai.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", listConfigs);
router.post("/", createConfig);
router.put("/:id", updateConfig);
router.delete("/:id", deleteConfig);
router.put("/:id/default", setDefault);
router.post("/test-generate", testGenerate);
router.post("/suggest-responses", suggestResponses);

export default router;
