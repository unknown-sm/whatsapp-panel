import { Request, Response } from "express";
import * as convService from "../services/conversation.service";
import { addScoreByCondition } from "../services/leadscore.service";
import { io } from "../index";
import { z } from "zod";

export async function listConversations(req: Request, res: Response) {
  try {
    const { status, botId, agentId, search } = req.query;
    const conversations = await convService.getConversations({
      status: status as string,
      botId: botId as string,
      agentId: agentId as string,
      search: search as string,
    });
    res.json({ conversations });
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
      addScoreByCondition(conv.contactId, "CONVERSATION_CLOSED", "Conversacion cerrada").catch(() => {});
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
    addScoreByCondition(req.params.contactId, "TAG_ADDED", "Tag agregado al contacto").catch(() => {});

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
    const contacts = await convService.getContacts(req.query.search as string);
    res.json({ contacts });
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
