import { Request, Response } from "express";
import axios from "axios";
import prisma from "../lib/prisma";
import { writeLog } from "../services/logs.service";
import * as fs from "fs";
import * as path from "path";

const WEBHOOK_EVENTS = ["message.received", "message.sent", "session.status", "session.disconnected"];

function cleanChromeLocks() {
  const sessionsPath = process.env.OPENWA_SESSIONS_PATH || "/openwa-data/sessions";
  
  if (!fs.existsSync(sessionsPath)) {
    console.log(`[cleanChromeLocks] Path does not exist: ${sessionsPath}`);
    return;
  }

  const sessionDirs = fs.readdirSync(sessionsPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(sessionsPath, d.name));

  console.log(`[cleanChromeLocks] Found ${sessionDirs.length} session directories`);

  for (const sessionDir of sessionDirs) {
    try {
      console.log(`[cleanChromeLocks] Deleting entire session directory: ${sessionDir}`);
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`[cleanChromeLocks] Deleted: ${sessionDir}`);
    } catch (e) {
      console.log(`[cleanChromeLocks] Failed to delete ${sessionDir}: ${e.message}`);
    }
  }
}

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
    const data = error.response?.data;
    const msg = data?.error?.message || data?.message || error.message || "Error de conexion";
    if (error.response?.status === 401) {
      await writeLog("error", "openwa", "test_connection", `API Key inválida: ${msg}`, { baseUrl });
      return res.status(401).json({ error: "API Key inválida" });
    }
    await writeLog("error", "openwa", "test_connection", msg, { baseUrl, status: error.response?.status, responseData: data });
    res.status(400).json({ error: msg });
  }
}

export async function getOpenwaStatus(req: Request, res: Response) {
  let config = await prisma.openwaConfig.findFirst();
  if (!config || !config.apiKey) {
    return res.json({ status: "not_configured", session: null, sessions: [], diagnostics: { hint: "Configurar API Key en el formulario" } });
  }
  try {
    const [sessionsRes, healthRes] = await Promise.all([
      axios.get(`${config.baseUrl}/api/sessions`, { headers: { "X-API-Key": config.apiKey }, timeout: 10000 }),
      axios.get(`${config.baseUrl}/api/health`, { headers: { "X-API-Key": config.apiKey }, timeout: 5000 }).catch(() => null),
    ]);
    const sessions: any[] = sessionsRes.data;
    const session = config.sessionId
      ? sessions.find((s: any) => s.id === config.sessionId) || null
      : sessions[0] || null;
    const status = session?.status || "disconnected";
    const diagnostics: any = { health: healthRes?.data || null };
    if (session?.status === "failed" || session?.status === "error") {
      diagnostics.hint = "La sesion fallo al iniciar. Probable problema con Chromium/Puppeteer. Hacé click Reset para reintentar.";
    } else if (status === "created" || status === "initializing") {
      diagnostics.hint = "Inicializando motor de WhatsApp. Espera unos segundos o resetea si lleva mas de 2 minutos.";
    } else if (status === "qr_ready") {
      diagnostics.hint = "QR listo, escanealo desde tu telefono.";
    } else if (status === "authenticating") {
      diagnostics.hint = "Autenticando con WhatsApp. Espera unos segundos.";
    } else if (status === "ready") {
      diagnostics.hint = "Conectado. Los mensajes llegaran automaticamente.";
    }
    await prisma.openwaConfig.update({ where: { id: config.id }, data: { status } });
    res.json({ status, session, sessions, diagnostics, lastCheckedAt: new Date().toISOString() });
  } catch (e: any) {
    await writeLog("error", "openwa", "status_check", e.message);
    if (config) {
      await prisma.openwaConfig.update({ where: { id: config.id }, data: { status: "error" } });
    }
    res.json({
      status: "error",
      session: null,
      sessions: [],
      error: e.message,
      diagnostics: { hint: "No se puede conectar con OpenWA. Verificar que el container este corriendo." },
      lastCheckedAt: new Date().toISOString(),
    });
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

async function checkSessionStatus(cfg: { baseUrl: string; apiKey: string; sessionId: string }): Promise<string> {
  try {
    const res = await axios.get(`${cfg.baseUrl}/api/sessions/${cfg.sessionId}`, {
      headers: { "X-API-Key": cfg.apiKey }, timeout: 10000,
    });
    return res.data?.status || "unknown";
  } catch (e: any) {
    return "not_found";
  }
}

async function createAndStart(cfg: { baseUrl: string; apiKey: string }): Promise<{ id: string; startOk: boolean }> {
  const created: any = (await axios.post(`${cfg.baseUrl}/api/sessions`, { name: "whatsapp-panel" }, {
    headers: { "X-API-Key": cfg.apiKey, "Content-Type": "application/json" },
    timeout: 15000,
  })).data;
  const newId = created.id;
  await writeLog("info", "openwa", "create", `Sesion creada: ${newId}`, { id: newId });
  let startOk = false;
  try {
    const startRes = await axios.post(`${cfg.baseUrl}/api/sessions/${newId}/start`, {}, {
      headers: { "X-API-Key": cfg.apiKey }, timeout: 60000,
    });
    await writeLog("info", "openwa", "start", `Sesion iniciada OK: ${newId}`, { status: startRes.data?.status });
    startOk = true;
  } catch (e: any) {
    const statusCode = e.response?.status;
    const data = e.response?.data;
    const errorMsg = data?.error?.message || data?.message || e.message;
    const errorCode = data?.error?.code;
    await writeLog("error", "openwa", "start", `Start fallo: status=${statusCode} code=${errorCode} msg=${errorMsg}`, {
      id: newId,
      httpStatus: statusCode,
      errorCode,
      responseData: data,
    });
  }
  return { id: newId, startOk };
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
    
    await writeLog("info", "openwa", "start_session", "Limpiando Chrome locks del filesystem");
    cleanChromeLocks();
    
    await writeLog("info", "openwa", "start_session", "Creando nueva sesion");
    const { id: sessionId, startOk } = await createAndStart({ baseUrl: config.baseUrl, apiKey: config.apiKey });

    if (!startOk) {
      await cleanupAllDuplicates({ baseUrl: config.baseUrl, apiKey: config.apiKey });
      await prisma.openwaConfig.update({ where: { id: config.id }, data: { sessionId: "" } });
      return res.status(500).json({
        error: `OpenWA devolvio 500 al iniciar sesion. Problema probable con Chromium/Puppeteer (memoria, permisos, dependencias). Resetea y reintenta.`,
        hint: "Revisa logs del container openwa en EasyPanel para mas detalles",
        sessionId,
      });
    }

    await prisma.openwaConfig.update({ where: { id: config.id }, data: { sessionId } });

    const startStatus = await checkSessionStatus({ baseUrl: config.baseUrl, apiKey: config.apiKey, sessionId });
    await writeLog("info", "openwa", "start_session", `Sesion creada: ${sessionId}, status actual: ${startStatus}`, { sessionId, status: startStatus });

    if (startStatus === "failed" || startStatus === "error") {
      await cleanupAllDuplicates({ baseUrl: config.baseUrl, apiKey: config.apiKey });
      await prisma.openwaConfig.update({ where: { id: config.id }, data: { sessionId: "" } });
      return res.status(500).json({
        error: `OpenWA no pudo iniciar la sesion (status: ${startStatus}). Esto indica un problema con Chromium/Puppeteer en el container. Click Reset y reintentar. Si persiste, revisar logs del container.`,
        hint: "Posible falta de memoria, permisos o dependencias Chromium",
      });
    }

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

    res.json({ sessionId, status: startStatus });
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
    
    await writeLog("info", "openwa", "reset_connection", "Limpiando Chrome locks del filesystem");
    cleanChromeLocks();
    
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
