import { Request, Response } from "express";
import axios from "axios";
import prisma from "../lib/prisma";
import { writeLog } from "../services/logs.service";

const WEBHOOK_EVENTS = ["message.received", "message.sent", "session.status", "session.disconnected"];

export async function getConfig(_req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  res.json({ config: config || { baseUrl: "http://openwa:2785", apiKey: "", sessionId: "", status: "disconnected" } });
}

export async function saveConfig(req: Request, res: Response) {
  const { baseUrl, apiKey, sessionId } = req.body;
  let config = await prisma.openwaConfig.findFirst();
  if (config) {
    config = await prisma.openwaConfig.update({ where: { id: config.id }, data: { baseUrl, apiKey, sessionId: sessionId || "" } });
  } else {
    config = await prisma.openwaConfig.create({ data: { baseUrl, apiKey, sessionId: sessionId || "" } });
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
    await writeLog("info", "openwa", "test_connection", `Test OK - ${result.data?.length || 0} sesiones`, { baseUrl });
    res.json({ status: "ok", sessions: result.data });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || "Error de conexion";
    if (error.response?.status === 401) {
      await writeLog("error", "openwa", "test_connection", `API Key inválida: ${msg}`, { baseUrl });
      return res.status(401).json({ error: "API Key inválida" });
    }
    await writeLog("error", "openwa", "test_connection", msg, { baseUrl, status: error.response?.status });
    res.status(400).json({ error: msg });
  }
}

export async function getOpenwaStatus(req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  if (!config || !config.apiKey) {
    return res.json({ status: "not_configured", session: null, sessions: [] });
  }
  try {
    const sessions: any[] = (await axios.get(`${config.baseUrl}/api/sessions`, {
      headers: { "X-API-Key": config.apiKey },
      timeout: 10000,
    })).data;
    const session = config.sessionId
      ? sessions.find((s: any) => s.id === config.sessionId) || null
      : sessions[0] || null;
    const status = session?.status || "disconnected";
    await prisma.openwaConfig.update({ where: { id: config.id }, data: { status } });
    res.json({ status, session, sessions });
  } catch (e: any) {
    if (config) {
      await prisma.openwaConfig.update({ where: { id: config.id }, data: { status: "error" } });
    }
    res.json({ status: "error", session: null, sessions: [], error: e.message });
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

async function cleanupAllDuplicates(cfg: { baseUrl: string; apiKey: string }) {
  try {
    const sessions: any[] = (await axios.get(`${cfg.baseUrl}/api/sessions`, {
      headers: { "X-API-Key": cfg.apiKey }, timeout: 10000,
    })).data;
    const dups = sessions.filter((s: any) => s.name === "whatsapp-panel");
    if (dups.length > 0) {
      await writeLog("info", "openwa", "cleanup", `Limpiando ${dups.length} sesion(es) duplicada(s)`, { count: dups.length });
    }
    for (const dup of dups) {
      try {
        await axios.post(`${cfg.baseUrl}/api/sessions/${dup.id}/stop`, {}, {
          headers: { "X-API-Key": cfg.apiKey }, timeout: 10000,
        });
        await writeLog("info", "openwa", "cleanup", `Sesion detenida: ${dup.id} (status: ${dup.status})`, { id: dup.id });
      } catch (e: any) {
        await writeLog("warn", "openwa", "cleanup", `Stop fallo (ignorado): ${e.message}`, { id: dup.id });
      }
      try {
        await axios.delete(`${cfg.baseUrl}/api/sessions/${dup.id}`, {
          headers: { "X-API-Key": cfg.apiKey }, timeout: 10000,
        });
        await writeLog("info", "openwa", "cleanup", `Sesion eliminada: ${dup.id}`, { id: dup.id });
      } catch (e: any) {
        await writeLog("warn", "openwa", "cleanup", `Delete fallo (ignorado): ${e.message}`, { id: dup.id });
      }
    }
  } catch (e: any) {
    await writeLog("error", "openwa", "cleanup", `cleanupAllDuplicates error: ${e.message}`);
  }
}

async function createAndStart(cfg: { baseUrl: string; apiKey: string }): Promise<string> {
  const created: any = (await axios.post(`${cfg.baseUrl}/api/sessions`, { name: "whatsapp-panel" }, {
    headers: { "X-API-Key": cfg.apiKey, "Content-Type": "application/json" },
    timeout: 15000,
  })).data;
  const newId = created.id;
  await writeLog("info", "openwa", "create", `Sesion creada: ${newId}`, { id: newId });
  try {
    const startRes = await axios.post(`${cfg.baseUrl}/api/sessions/${newId}/start`, {}, {
      headers: { "X-API-Key": cfg.apiKey }, timeout: 60000,
    });
    await writeLog("info", "openwa", "start", `Sesion iniciada OK: ${newId}`, { status: startRes.data?.status });
  } catch (e: any) {
    const statusCode = e.response?.status;
    const data = e.response?.data;
    await writeLog("error", "openwa", "start", `Start fallo: status=${statusCode} msg=${data?.message || e.message}`, {
      id: newId,
      httpStatus: statusCode,
      responseData: data,
      stack: e.stack,
    });
  }
  return newId;
}

export async function startSession(req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  if (!config || !config.apiKey) {
    await writeLog("warn", "openwa", "start_session", "OpenWA no configurado");
    return res.status(400).json({ error: "OpenWA no configurado" });
  }
  try {
    await writeLog("info", "openwa", "start_session", "Limpiando sesiones duplicadas");
    await cleanupAllDuplicates({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    await writeLog("info", "openwa", "start_session", "Creando nueva sesion");
    const sessionId = await createAndStart({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    await prisma.openwaConfig.update({ where: { id: config.id }, data: { sessionId } });
    await writeLog("info", "openwa", "start_session", `Sesion creada e iniciada: ${sessionId}`, { sessionId });

    const webhookUrl = `${req.protocol}://${req.get("host")}/webhook/incoming`;
    try {
      const existing: any[] = (await axios.get(`${config.baseUrl}/api/sessions/${sessionId}/webhooks`, {
        headers: { "X-API-Key": config.apiKey }, timeout: 10000,
      })).data;
      if (!Array.isArray(existing) || !existing.some((w: any) => w.url === webhookUrl)) {
        await axios.post(`${config.baseUrl}/api/sessions/${sessionId}/webhooks`, {
          url: webhookUrl,
          events: WEBHOOK_EVENTS,
          secret: "whatsapp-panel-webhook-secret",
        }, {
          headers: { "X-API-Key": config.apiKey, "Content-Type": "application/json" },
          timeout: 10000,
        });
        await writeLog("info", "openwa", "webhook_setup", `Webhook configurado: ${webhookUrl}`);
      } else {
        await writeLog("info", "openwa", "webhook_setup", "Webhook ya configurado");
      }
    } catch (e: any) {
      await writeLog("error", "openwa", "webhook_setup", `auto-webhook setup failed: ${e.response?.data?.message || e.message}`, { sessionId });
    }

    res.json({ sessionId, status: "started" });
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || "Unknown error";
    await writeLog("error", "openwa", "start_session", msg, { status: error.response?.status });
    res.status(400).json({ error: msg });
  }
}

export async function resetConnection(req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  if (!config || !config.apiKey) {
    return res.status(400).json({ error: "OpenWA no configurado" });
  }
  try {
    await writeLog("warn", "openwa", "reset_connection", "Reset manual solicitado");
    await cleanupAllDuplicates({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    await prisma.openwaConfig.update({ where: { id: config.id }, data: { sessionId: "" } });
    await writeLog("info", "openwa", "reset_connection", "Reset completo, sessionId limpiado");
    res.json({ message: "Conexion reseteada. Click Conectar para nueva sesion." });
  } catch (error: any) {
    await writeLog("error", "openwa", "reset_connection", error.message);
    res.status(400).json({ error: error.message });
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
      events: WEBHOOK_EVENTS,
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
