import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import * as ctrl from "../controllers/n8n.controller";

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get("/workflows", ctrl.listN8nWorkflows);
router.post("/import", ctrl.importWorkflows);
router.post("/setup", ctrl.setupEverything);

export default router;
