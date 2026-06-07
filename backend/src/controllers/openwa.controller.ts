import { Request, Response } from "express";
import axios from "axios";
import prisma from "../lib/prisma";

export async function getConfig(_req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  res.json({ config: config || { baseUrl: "http://openwa:2785", apiKey: "", sessionId: "", status: "disconnected" } });
}

export async function saveConfig(req: Request, res: Response) {
  const { baseUrl, apiKey, sessionId } = req.body;
  let config = await prisma.openwaConfig.findFirst();
  if (config) {
    config = await prisma.openwaConfig.update({ where: { id: config.id }, data: { baseUrl, apiKey, sessionId } });
  } else {
    config = await prisma.openwaConfig.create({ data: { baseUrl, apiKey, sessionId } });
  }
  res.json({ config });
}

export async function testConnection(req: Request, res: Response) {
  const { baseUrl, apiKey } = req.body;
  try {
    const result = await axios.get(`${baseUrl}/api/sessions`, {
      headers: { "X-API-Key": apiKey },
      timeout: 10000,
    });
    res.json({ status: "ok", sessions: result.data });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    res.status(400).json({ error: msg });
  }
}

export async function getOpenwaStatus(req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  if (!config || !config.apiKey) {
    return res.json({ status: "not_configured", session: null });
  }
  try {
    const sessions: any[] = (await axios.get(`${config.baseUrl}/api/sessions`, {
      headers: { "X-API-Key": config.apiKey },
      timeout: 10000,
    })).data;
    const session = config.sessionId
      ? sessions.find((s: any) => s.id === config.sessionId)
      : sessions[0] || null;
    const status = session?.status || "disconnected";
    if (config) {
      await prisma.openwaConfig.update({ where: { id: config.id }, data: { status } });
    }
    res.json({ status, session, sessions });
  } catch (e: any) {
    const errMsg = e.response?.data?.message || e.message || "error";
    if (config) {
      await prisma.openwaConfig.update({ where: { id: config.id }, data: { status: "error" } });
    }
    res.json({ status: "error", session: null, error: errMsg });
  }
}

export async function getQrCode(req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  if (!config || !config.apiKey || !config.sessionId) {
    return res.status(400).json({ error: "OpenWA no configurado" });
  }
  try {
    const result = await axios.get(`${config.baseUrl}/api/sessions/${config.sessionId}/qr`, {
      headers: { "X-API-Key": config.apiKey },
      timeout: 15000,
    });
    res.json({ qrCode: result.data.qrCode || result.data.code, status: result.data.status });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    res.status(400).json({ error: msg });
  }
}

export async function startSession(req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  if (!config || !config.apiKey) {
    return res.status(400).json({ error: "OpenWA no configurado" });
  }
  let sessionId = config.sessionId || "";
  try {
    if (sessionId) {
      const sessions: any[] = (await axios.get(`${config.baseUrl}/api/sessions`, {
        headers: { "X-API-Key": config.apiKey }, timeout: 10000,
      })).data;
      const session = sessions.find((s: any) => s.id === sessionId);
      if (session && (session.status === "failed" || session.status === "error")) {
        await axios.delete(`${config.baseUrl}/api/sessions/${sessionId}`, {
          headers: { "X-API-Key": config.apiKey }, timeout: 10000,
        });
        const created: any = (await axios.post(`${config.baseUrl}/api/sessions`, { name: "whatsapp-panel" }, {
          headers: { "X-API-Key": config.apiKey, "Content-Type": "application/json" },
          timeout: 15000,
        })).data;
        sessionId = created.id;
      } else {
        await axios.post(`${config.baseUrl}/api/sessions/${sessionId}/start`, {}, {
          headers: { "X-API-Key": config.apiKey }, timeout: 30000,
        });
      }
    } else {
      const existing: any[] = (await axios.get(`${config.baseUrl}/api/sessions`, {
        headers: { "X-API-Key": config.apiKey }, timeout: 10000,
      })).data;
      const dup = existing.find((s: any) => s.name === "whatsapp-panel");
      if (dup) {
        await axios.delete(`${config.baseUrl}/api/sessions/${dup.id}`, {
          headers: { "X-API-Key": config.apiKey }, timeout: 10000,
        });
      }
      const created: any = (await axios.post(`${config.baseUrl}/api/sessions`, { name: "whatsapp-panel" }, {
        headers: { "X-API-Key": config.apiKey, "Content-Type": "application/json" },
        timeout: 15000,
      })).data;
      sessionId = created.id;
    }
    await prisma.openwaConfig.update({ where: { id: config.id }, data: { sessionId } });
    res.json({ sessionId, status: "started" });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || "Unknown error";
    console.error("startSession error:", msg);
    res.status(400).json({ error: msg });
  }
}

export async function setupWebhook(req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  if (!config || !config.apiKey || !config.sessionId) {
    return res.status(400).json({ error: "OpenWA no configurado" });
  }
  const webhookUrl = `${req.protocol}://${req.get("host")}/webhook/incoming`;
  try {
    const existing: any[] = (await axios.get(`${config.baseUrl}/api/sessions/${config.sessionId}/webhooks`, {
      headers: { "X-API-Key": config.apiKey },
      timeout: 10000,
    })).data;
    if (Array.isArray(existing) && existing.some((w: any) => w.url === webhookUrl)) {
      return res.json({ message: "Webhook ya configurado", url: webhookUrl });
    }
    await axios.post(`${config.baseUrl}/api/sessions/${config.sessionId}/webhooks`, {
      url: webhookUrl,
      events: ["message.received", "message.sent", "session.status"],
      secret: "whatsapp-panel-webhook-secret",
    }, {
      headers: { "X-API-Key": config.apiKey, "Content-Type": "application/json" },
      timeout: 10000,
    });
    res.json({ message: "Webhook configurado", url: webhookUrl });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    res.status(400).json({ error: msg });
  }
}
