import { Request, Response } from "express";
import { processIncomingMessage } from "../services/whatsapp.service";
import prisma from "../lib/prisma";

export async function webhookVerify(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const config = await prisma.whatsappConfig.findFirst();

  if (mode === "subscribe" && token === config?.verifyToken) {
    await prisma.whatsappConfig.updateMany({
      data: { status: "online", lastPing: new Date() },
    });
    return res.status(200).send(String(challenge));
  }

  res.sendStatus(403);
}

export async function webhookIncoming(req: Request, res: Response) {
  try {
    let payload = req.body;

    // Detect and convert OpenWA webhook format
    if (payload.event === "message.received" && payload.data) {
      const d = payload.data;
      payload = {
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: d.from?.replace("@c.us", "") || d.chatId?.replace("@c.us", ""),
                text: { body: d.body || "" },
                type: d.type || "text",
              }],
            },
          }],
        }],
      };
    } else if (payload.event && !payload.entry) {
      // Ignore non-message events for now (session.status, session.qr, etc.)
      return res.sendStatus(200);
    }

    // Extract CTWA ref parameter and metadata from Meta webhook
    const change = payload.entry?.[0]?.changes?.[0];
    const msg = change?.value?.messages?.[0];
    if (msg?.ref) {
      payload.ref = msg.ref;
    }
    if (change?.value?.metadata) {
      payload.metadata = change.value.metadata;
    }

    await processIncomingMessage(payload);
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
}

export async function getStatus(req: Request, res: Response) {
  const config = await prisma.whatsappConfig.findFirst();
  res.json({
    status: config?.status || "offline",
    lastPing: config?.lastPing,
    configured: !!config,
  });
}

export async function testConnection(req: Request, res: Response) {
  const config = await prisma.whatsappConfig.findFirst();
  if (!config) {
    return res.status(400).json({ error: "WhatsApp no configurado" });
  }

  try {
    const axios = await import("axios");
    await axios.default.get(`https://graph.facebook.com/v21.0/${config.phoneNumberId}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    await prisma.whatsappConfig.updateMany({ data: { status: "online", lastPing: new Date() } });
    res.json({ status: "ok", message: "Conexion exitosa" });
  } catch {
    await prisma.whatsappConfig.updateMany({ data: { status: "offline" } });
    res.status(500).json({ error: "No se pudo conectar a WhatsApp" });
  }
}

export async function updateConfig(req: Request, res: Response) {
  const { phoneNumberId, accessToken, verifyToken } = req.body;

  const existing = await prisma.whatsappConfig.findFirst();

  if (existing) {
    const config = await prisma.whatsappConfig.update({
      where: { id: existing.id },
      data: { phoneNumberId, accessToken, verifyToken },
    });
    return res.json({ config });
  }

  const config = await prisma.whatsappConfig.create({
    data: { phoneNumberId, accessToken, verifyToken, webhookUrl: "/webhook/incoming" },
  });
  res.status(201).json({ config });
}
