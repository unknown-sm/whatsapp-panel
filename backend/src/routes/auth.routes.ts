import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, register, getMe } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();

/* Rate limit: 10 intentos por IP cada 15 min en login */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera 15 minutos." },
  skipSuccessfulRequests: true,
});

/* Rate limit: 5 registros por IP cada hora (anti spam) */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados registros. Intenta en 1 hora." },
});

/* Rate limit global: 100 req por IP cada minuto (mitigates DoS) */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Espera 1 minuto." },
});

router.post("/login", loginLimiter, login);
router.post("/register", registerLimiter, register);
router.get("/me", authMiddleware, getMe);

export default router;
export { globalLimiter };
