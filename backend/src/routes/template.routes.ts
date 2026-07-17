import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as templateController from "../controllers/template.controller";

const router = Router();
router.use(authenticate);

router.get("/", templateController.listTemplates);
router.get("/approved", templateController.listApproved);
router.get("/sync", templateController.syncWithMeta);
router.post("/sync", templateController.syncWithMeta);
router.get("/:id", templateController.getTemplate);
router.post("/", requireAdmin, templateController.createTemplate);
router.put("/:id", requireAdmin, templateController.updateTemplate);
router.delete("/:id", requireAdmin, templateController.deleteTemplate);
router.post("/:id/send", templateController.sendTemplate);

export default router;