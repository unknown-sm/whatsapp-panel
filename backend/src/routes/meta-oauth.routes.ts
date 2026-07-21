import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as metaOAuthController from "../controllers/meta-oauth.controller";

const router = Router();
router.use(authenticate);

router.get("/config", metaOAuthController.getCurrentConfig);
router.post("/exchange", requireAdmin, metaOAuthController.exchangeCode);
router.post("/wabas", requireAdmin, metaOAuthController.listWABAs);
router.post("/phone-numbers", requireAdmin, metaOAuthController.listPhoneNumbers);
router.post("/complete-signup", requireAdmin, metaOAuthController.completeSignup);
router.post("/disconnect", requireAdmin, metaOAuthController.disconnect);

export default router;