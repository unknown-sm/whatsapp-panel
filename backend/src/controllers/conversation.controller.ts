import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import * as convService from "../services/conversation.service";
import { addScoreByCondition } from "../services/leadscore.service";
import { resolveEngine } from "../services/whatsapp-engine";
import prisma from "../lib/prisma";
import { getIo } from "../lib/socket";
import { z } from "zod";
import { requireOrgId } from "../lib/tenant";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* Allowlist de MIME aceptados (los que Meta soporta para media saliente) */
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/3gpp", "video/quicktime",
  "audio/ogg", "audio/mpeg", "audio/mp4", "audio/amr",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || "";
      cb(null, `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export async function listConversations(req: Request, res: Response) {
  try {
    const { status, botId, agentId, search, page, pageSize } = req.query;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const result = await convService.getConversations({
      status: status as string,
      botId: botId as string,
      agentId: agentId as string,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      orgId,
    });
    res.json(result);
  } catch {
    res.status(500).json({ error: "Error al obtener conversaciones" });
  }
}

export async function getConversation(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const conv = await convService.getConversation(req.params.id, orgId);
    if (!conv) return res.status(404).json({ error: "Conversacion no encontrada" });
    res.json({ conversation: conv });
  } catch {
    res.status(500).json({ error: "Error al obtener conversacion" });
  }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const owned = await convService.getOwnedConversation(req.params.id, orgId);
    if (!owned) return res.status(404).json({ error: "Conversacion no encontrada" });
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    const message = await convService.sendMessage(req.params.id, content);
    getIo().to(req.params.id).emit("message:new", message);
    // Lead scoring: MESSAGE_SENT
    try {
      const conv = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { contactId: true } });
      if (conv?.contactId) {
        addScoreByCondition((req as any).user?.orgId || "", conv.contactId, "MESSAGE_SENT", "Mensaje enviado por agente").catch(() => {});
      }
    } catch {}
    res.json({ message });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    if (error?.code === "WINDOW_CLOSED") {
      return res.status(400).json({
        error: "La ventana de 24 horas está cerrada. Meta solo permite responder con un template aprobado.",
        code: "WINDOW_CLOSED",
      });
    }
    res.status(500).json({ error: "Error al enviar mensaje" });
  }
}

export async function assignAgent(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const owned = await convService.getOwnedConversation(req.params.id, orgId);
    if (!owned) return res.status(404).json({ error: "Conversacion no encontrada" });
    const { agentId } = z.object({ agentId: z.string().uuid() }).parse(req.body);
    const conv = await convService.assignAgent(req.params.id, agentId);
    getIo().emit("agent:assigned", { conversationId: req.params.id, agentId });
    res.json({ conversation: conv });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al asignar agente" });
  }
}

export async function updateStatus(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const owned = await convService.getOwnedConversation(req.params.id, orgId);
    if (!owned) return res.status(404).json({ error: "Conversacion no encontrada" });
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const conv = await convService.updateStatus(req.params.id, status);
    getIo().emit("conversation:updated", { id: req.params.id, status });

    // Lead scoring: CONVERSATION_CLOSED
    if (status === "closed" && conv?.contactId) {
      addScoreByCondition((req as any).user?.orgId || "", conv.contactId, "CONVERSATION_CLOSED", "Conversacion cerrada").catch(() => {});
    }

    res.json({ conversation: conv });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al actualizar estado" });
  }
}

export async function addNote(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const owned = await convService.getOwnedContact(req.params.contactId, orgId);
    if (!owned) return res.status(404).json({ error: "Contacto no encontrado" });
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    const agentId = (req as any).user?.id;
    const note = await convService.addNote(req.params.contactId, content, agentId);
    res.status(201).json({ note });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al agregar nota" });
  }
}

export async function addTag(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const owned = await convService.getOwnedContact(req.params.contactId, orgId);
    if (!owned) return res.status(404).json({ error: "Contacto no encontrado" });
    const { tagId } = z.object({ tagId: z.string().uuid() }).parse(req.body);
    await convService.addTag(req.params.contactId, tagId);

    // Lead scoring: TAG_ADDED
    addScoreByCondition((req as any).user?.orgId || "", req.params.contactId, "TAG_ADDED", "Tag agregado al contacto").catch(() => {});

    res.json({ message: "Tag agregado" });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al agregar tag" });
  }
}

export async function removeTag(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const owned = await convService.getOwnedContact(req.params.contactId, orgId);
    if (!owned) return res.status(404).json({ error: "Contacto no encontrado" });
    await convService.removeTag(req.params.contactId, req.params.tagId);
    res.json({ message: "Tag eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar tag" });
  }
}

export async function listContacts(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { search, page, pageSize } = req.query;
    const result = await convService.getContacts(
      search as string,
      page ? parseInt(page as string) : undefined,
      pageSize ? parseInt(pageSize as string) : undefined,
      orgId,
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: "Error al obtener contactos" });
  }
}

export async function exportContacts(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const data = await convService.exportContacts(orgId);
    // Neutralizar CSV injection: prefijar valores que empiezan con = + - @
    const safe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""');
    const csv = [
      "Telefono,Nombre,Primer Contacto,Ultima Actividad,Tags",
      ...data.map((c) => `"${safe(c.phone)}","${safe(c.name)}","${c.firstContact}","${c.lastActivity}","${safe(c.tags)}"`),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contactos.csv");
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Error al exportar" });
  }
}

/* ── Outbound media (upload + send) ───────────────── */

const MIME_TO_TYPE: Record<string, "image" | "video" | "document" | "audio"> = {
  "image/jpeg": "image", "image/png": "image", "image/webp": "image", "image/gif": "image",
  "video/mp4": "video", "video/3gpp": "video", "video/quicktime": "video",
  "audio/ogg": "audio", "audio/mpeg": "audio", "audio/mp4": "audio", "audio/amr": "audio",
  "application/pdf": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "text/plain": "document",
};

export { upload };

export async function sendMedia(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { caption, type: typeOverride } = req.body as { caption?: string; type?: string };
    const file = (req as any).file;

    if (!file) return res.status(400).json({ error: "archivo requerido" });

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, orgId },
      include: { contact: true },
    });
    if (!conversation) return res.status(404).json({ error: "Conversacion no encontrada" });

    const mimeType = file.mimetype || "application/octet-stream";
    const mediaType = (typeOverride as any) || MIME_TO_TYPE[mimeType] || "document";
    const filename = file.originalname;

    // Gate de la ventana de 24h: media también requiere ventana abierta
    const { canSendFreeForm, trackOutbound } = await import("../services/session.service");
    const window = await canSendFreeForm(conversation.contact.id);
    if (!window.allowed) {
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(400).json({
        error: "La ventana de 24 horas está cerrada. Meta solo permite responder con un template aprobado.",
        code: "WINDOW_CLOSED",
      });
    }

    const engine = resolveEngine();
    const buffer = fs.readFileSync(file.path);
    const ok = await engine.sendMedia(
      conversation.contact.phone,
      buffer,
      mimeType,
      mediaType,
      caption,
      filename
    );
    if (ok) trackOutbound(conversation.contact.id).catch(() => {});

    if (!ok) {
      // Cleanup file
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(500).json({ error: "Meta rechazo el envio. Verifica que el numero esta registrado en Meta." });
    }

    // Save message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "outbound",
        type: mediaType,
        content: caption || `[${mediaType}]`,
        mediaUrl: `/uploads/${path.basename(file.path)}`,
        mediaLocalPath: file.path,
        mediaMimeType: mimeType,
        mediaFilename: filename,
        mediaSize: file.size,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    getIo().to(conversation.id).emit("message:new", {
      ...message,
      timestamp: message.timestamp.toISOString(),
    });
    getIo().emit("conversation:updated", { id: conversation.id, updatedAt: new Date() });

    res.json({ success: true, message });
  } catch (err: any) {
    console.error("sendMedia error:", err);
    res.status(500).json({ error: err.message });
  }
}

/* Bulk contacts import (CSV) */
export async function importContacts(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { contacts } = req.body as { contacts: { phone: string; name?: string }[] };
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: "contacts[] requerido (array de {phone, name?})" });
    }
    if (contacts.length > 1000) {
      return res.status(400).json({ error: "Maximo 1000 contactos por carga" });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of contacts) {
      try {
        if (!item.phone || !/^\d{7,15}$/.test(item.phone)) {
          errors.push(`Telefono invalido: ${item.phone}`);
          skipped++;
          continue;
        }
        const existing = await prisma.contact.findUnique({ where: { phone: item.phone } });
        if (existing) {
          // No reasignar contactos de otra organización
          skipped++;
          continue;
        }
        await prisma.contact.create({ data: { phone: item.phone, name: item.name || null, orgId } });
        created++;
      } catch (err: any) {
        errors.push(`${item.phone}: ${err.message}`);
        skipped++;
      }
    }

    res.json({ created, skipped, errors: errors.slice(0, 10), total: contacts.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteContact(req: Request, res: Response) {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const owned = await prisma.contact.findFirst({ where: { id: req.params.id, orgId }, select: { id: true } });
    if (!owned) return res.status(404).json({ error: "Contacto no encontrado" });
    await prisma.message.deleteMany({ where: { conversation: { contactId: req.params.id } } });
    await prisma.conversation.deleteMany({ where: { contactId: req.params.id } });
    await prisma.contactTags.deleteMany({ where: { contactId: req.params.id } });
    await prisma.contactNote.deleteMany({ where: { contactId: req.params.id } });
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
