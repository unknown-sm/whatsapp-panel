import { Router } from "express";
import { listBots, getBot, createBot, updateBot, deleteBot, addKeyword, removeKeyword, setDefault, testBot } from "../controllers/bot.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", listBots);
router.get("/:id", getBot);
router.post("/", createBot);
router.put("/:id", updateBot);
router.delete("/:id", deleteBot);
router.post("/:id/keywords", addKeyword);
router.delete("/:id/keywords/:keywordId", removeKeyword);
router.put("/:id/default", setDefault);
router.post("/:id/test", testBot);

export default router;