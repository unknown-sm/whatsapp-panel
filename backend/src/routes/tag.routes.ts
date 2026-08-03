import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as ctrl from "../controllers/tag.controller";

const router = Router();
router.use(authenticate);

router.get("/", ctrl.getTags);
router.post("/", requireAdmin, ctrl.createTag);
router.put("/:id", requireAdmin, ctrl.updateTag);
router.delete("/:id", requireAdmin, ctrl.deleteTag);
router.post("/assign", ctrl.assignTag);
router.delete("/assign", ctrl.removeTag);
router.get("/contact/:contactId", ctrl.getContactTags);

export default router;
