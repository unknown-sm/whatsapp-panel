import { Router } from "express";
import multer from "multer";
import { listKnowledge, uploadKnowledge, deleteKnowledge } from "../controllers/knowledge.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".txt", ".md", ".csv", ".pdf", ".docx", ".json", ".xml", ".html"];
    const ext = "." + file.originalname.split(".").pop()?.toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("Tipo de archivo no soportado: " + ext));
  },
});

router.get("/", listKnowledge);
router.post("/", upload.single("file"), uploadKnowledge);
router.delete("/:id", deleteKnowledge);

export default router;
