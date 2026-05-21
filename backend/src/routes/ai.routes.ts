import { Router } from "express";
import { listConfigs, createConfig, updateConfig, deleteConfig, setDefault } from "../controllers/ai.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", listConfigs);
router.post("/", createConfig);
router.put("/:id", updateConfig);
router.delete("/:id", deleteConfig);
router.put("/:id/default", setDefault);

export default router;
