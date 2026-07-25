import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as ctrl from "../controllers/agent-chat.controller";

const router = Router();
router.use(authenticate);

router.get("/conversations", ctrl.getConversations);
router.get("/conversations/:partnerId", ctrl.getMessages);
router.post("/send", ctrl.sendMessage);
router.get("/unread-count", ctrl.getUnreadCount);

export default router;
