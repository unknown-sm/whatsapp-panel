import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as ctrl from "../controllers/customfield.controller";

const router = Router();

router.get("/", authenticate, ctrl.getCustomFields);
router.post("/", authenticate, requireAdmin, ctrl.createCustomField);
router.patch("/:id", authenticate, requireAdmin, ctrl.updateCustomField);
router.delete("/:id", authenticate, requireAdmin, ctrl.deleteCustomField);

router.post("/values", authenticate, ctrl.setCustomFieldValue);
router.get("/contact/:contactId", authenticate, ctrl.getContactCustomValues);

export default router;
