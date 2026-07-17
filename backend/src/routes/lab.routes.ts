import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as labController from "../controllers/lab.controller";

const router = Router();
router.use(authenticate);

router.get("/personas", labController.getPersonas);
router.get("/runs", labController.getRecentRuns);
router.get("/runs/:id", labController.getRun);
router.post("/runs", labController.createRun);
router.post("/suggestions/apply", labController.applySuggestion);

export default router;