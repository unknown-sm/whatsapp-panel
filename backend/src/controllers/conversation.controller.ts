import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import * as convService from "../services/conversation.service";
import { addScoreByCondition } from "../services/leadscore.service";
import { resolveEngine } from "../services/whatsapp-engine";
import prisma from "../lib/prisma";
import { io } from "../index";
import { z } from "zod";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export async function listConversations(req: Request, res: Response) {
  try {
    const { status, botId, agentId, search, page, pageSize } = req.query;
    const orgId = (req as any).user?.orgId;
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
    const conv = await convService.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversacion no encontrada" });
    res.json({ conversation: conv });
  } catch {
    res.status(500).json({ error: "Error al obtener conversacion" });
  }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    const message = await convService.sendMessage(req.params.id, content);
    io.to(req.params.id).emit("message:new", message);
    // Lead scoring: MESSAGE_SENT
    try {
      const conv = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { contactId: true } });
      if (conv?.contactId) {
        addScoreByCondition((req as any).user?.orgId || "", conv.contactId, "MESSAGE_SENT", "Mensaje enviado por agente").catch(() => {});
      }
    } catch {}
    res.json({ message });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al enviar mensaje" });
  }
}

export async function assignAgent(req: Request, res: Response) {
  try {
    const { agentId } = z.object({ agentId: z.string().uuid() }).parse(req.body);
    const conv = await convService.assignAgent(req.params.id, agentId);
    io.emit("agent:assigned", { conversationId: req.params.id, agentId });
    res.json({ conversation: conv });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error al asignar agente" });
  }
}

export async function updateStatus(req: Request, res: Response) {
  try {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const conv = await convService.updateStatus(req.params.id, status);
    io.emit("conversation:updated", { id: req.params.id, status });

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
    await convService.removeTag(req.params.contactId, req.params.tagId);
    res.json({ message: "Tag eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar tag" });
  }
}

export async function listContacts(req: Request, res: Response) {
  try {
    const { search, page, pageSize } = req.query;
    const result = await convService.getContacts(
      search as string,
      page ? parseInt(page as string) : undefined,
      pageSize ? parseInt(pageSize as string) : undefined,
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: "Error al obtener contactos" });
  }
}

export async function exportContacts(req: Request, res: Response) {
  try {
    const data = await convService.exportContacts();
    const csv = [
      "Telefono,Nombre,Primer Contacto,Ultima Actividad,Tags",
      ...data.map((c) => `"${c.phone}","${c.name}","${c.firstContact}","${c.lastActivity}","${c.tags}"`),
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
    const { caption, type: typeOverride } = req.body as { caption?: string; type?: string };
    const file = (req as any).file;

    if (!file) return res.status(400).json({ error: "archivo requerido" });

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { contact: true },
    });
    if (!conversation) return res.status(404).json({ error: "Conversacion no encontrada" });

    const mimeType = file.mimetype || "application/octet-stream";
    const mediaType = (typeOverride as any) || MIME_TO_TYPE[mimeType] || "document";
    const filename = file.originalname;

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

    io.to(conversation.id).emit("message:new", {
      ...message,
      timestamp: message.timestamp.toISOString(),
    });
    io.emit("conversation:updated", { id: conversation.id, updatedAt: new Date() });

    res.json({ success: true, message });
  } catch (err: any) {
    console.error("sendMedia error:", err);
    res.status(500).json({ error: err.message });
  }
}

/* Bulk contacts import (CSV) */
export async function importContacts(req: Request, res: Response) {
  try {
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
          skipped++;
          continue;
        }
        await prisma.contact.create({ data: { phone: item.phone, name: item.name || null } });
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
