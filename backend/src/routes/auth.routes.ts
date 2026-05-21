import { Router } from "express";
import { login, register, getMe } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.post("/login", login);
router.post("/register", register);
router.get("/me", authMiddleware, getMe);
export default router;