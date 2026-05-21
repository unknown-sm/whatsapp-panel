import { Router } from "express";
import {
  listConversations, getConversation, sendMessage, assignAgent,
  updateStatus, addNote, addTag, removeTag, listContacts, exportContacts,
} from "../controllers/conversation.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

// Static routes FIRST (before /:id)
router.get("/", listConversations);
router.get("/contacts", listContacts);
router.get("/contacts/export", exportContacts);

// Dynamic routes AFTER static routes
router.get("/:id", getConversation);
router.post("/:id/messages", sendMessage);
router.put("/:id/agent", assignAgent);
router.put("/:id/status", updateStatus);
router.post("/:contactId/notes", addNote);
router.post("/:contactId/tags", addTag);
router.delete("/:contactId/tags/:tagId", removeTag);

export default router;
