import { Request, Response } from "express";
import crypto from "crypto";
import { processIncomingMessage } from "../services/whatsapp.service";
import * as mediaService from "../services/media.service";
import { encrypt, decrypt, isEncrypted } from "../services/crypto.service";
import prisma from "../lib/prisma";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // Compare against itself to keep the timing profile flat
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

let warnedUnsigned = 0;

/**
 * Meta signs every webhook POST with X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(appSecret, rawBody).
 * When META_APP_SECRET is set the signature is mandatory (timing-safe compare).
 * Without it, dev accepts with a warning; production accepts but logs a loud error
 * so a missing env never silently disables verification after it is configured.
 */
function isSignatureValid(req: Request): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    if (process.env.NODE_ENV === "production") {
      if (Date.now() - warnedUnsigned > 60_000) {
        warnedUnsigned = Date.now();
        console.error("[WEBHOOK] META_APP_SECRET no configurada: payload aceptado SIN verificar firma. Configurala en App Dashboard > Settings > App secret.");
      }
      return true;
    }
    console.warn("[WEBHOOK] META_APP_SECRET no configurada (dev): payload aceptado sin verificar firma");
    return true;
  }
  const header = req.headers["x-hub-signature-256"];
  if (typeof header !== "string" || !header.startsWith("sha256=")) return false;
  const raw = (req as any).rawBody;
  if (!raw || !Buffer.isBuffer(raw)) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
  return timingSafeEqualStr(header, expected);
}

export async function webhookVerify(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const config = await prisma.whatsappConfig.findFirst();
  const storedToken = config?.verifyToken && isEncrypted(config.verifyToken) ? decrypt(config.verifyToken) : config?.verifyToken;

  if (mode === "subscribe" && !!storedToken && !!token && timingSafeEqualStr(String(token), storedToken)) {
    if (config) {
      await prisma.whatsappConfig.update({
        where: { id: config.id },
        data: { status: "online", lastPing: new Date() },
      });
    }
    return res.status(200).send(String(challenge));
  }

  res.sendStatus(403);
}

export async function webhookIncoming(req: Request, res: Response) {
  if (!isSignatureValid(req)) {
    return res.status(401).send("Invalid signature");
  }
  console.log("[WEBHOOK] Recibido:", JSON.stringify(req.body).slice(0, 300));
  try {
    let payload = req.body;

    // Detect and convert OpenWA webhook format
    if (payload.event === "message.received" && payload.data) {
      const d = payload.data;
      const type = d.type || "text";
      const msgObj: any = {
        from: d.from?.replace("@c.us", "") || d.chatId?.replace("@c.us", ""),
        type,
        timestamp: d.timestamp ? String(d.timestamp * 1000) : undefined,
      };
      if (type === "text") {
        msgObj.text = { body: d.body || "" };
      } else if (["image", "audio", "voice", "video", "document", "sticker"].includes(type)) {
        const mediaObj: any = { id: d.mediaKey || d.id || d.body };
        if (d.mimetype) mediaObj.mime_type = d.mimetype;
        if (d.caption) mediaObj.caption = d.caption;
        if (d.filename) mediaObj.filename = d.filename;
        msgObj[type] = mediaObj;
      } else {
        msgObj.text = { body: d.body || `[${type}]` };
      }
      payload = {
        entry: [{
          changes: [{
            value: { messages: [msgObj] },
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

  const accessToken = isEncrypted(config.accessToken) ? decrypt(config.accessToken) : config.accessToken;

  try {
    const axios = await import("axios");
    await axios.default.get(`https://graph.facebook.com/v21.0/${config.phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
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

  // Encrypt sensitive fields at rest
  const encryptedToken = encrypt(accessToken);
  const encryptedVerify = verifyToken ? encrypt(verifyToken) : null;

  const existing = await prisma.whatsappConfig.findFirst();

  if (existing) {
    const config = await prisma.whatsappConfig.update({
      where: { id: existing.id },
      data: {
        phoneNumberId,
        accessToken: encryptedToken,
        verifyToken: encryptedVerify || existing.verifyToken,
      },
    });
    return res.json({ config: { id: config.id, phoneNumberId: config.phoneNumberId, status: config.status, configured: true } });
  }

  const config = await prisma.whatsappConfig.create({
    data: {
      phoneNumberId,
      accessToken: encryptedToken,
      verifyToken: encryptedVerify || verifyToken,
      webhookUrl: "/webhook/incoming",
    },
  });
  res.status(201).json({ config: { id: config.id, phoneNumberId: config.phoneNumberId, status: config.status, configured: true } });
}
