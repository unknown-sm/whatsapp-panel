import { Request, Response } from "express";
import * as metaOAuth from "../services/meta-oauth.service";
import prisma from "../lib/prisma";
import { decrypt, isEncrypted } from "../services/crypto.service";

/* ── Step 1: Intercambiar code por token (preview) ──────── */

export async function exchangeCode(req: Request, res: Response) {
  try {
    const { code, redirectUri } = req.body;
    if (!code) return res.status(400).json({ error: "code requerido" });

    const result = await metaOAuth.exchangeCodeForToken({ code, redirectUri });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/* ── Step 2: Listar WABAs disponibles (preview) ─────────── */

export async function listWABAs(req: Request, res: Response) {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: "accessToken requerido" });
    const wabas = await metaOAuth.getWABAs(accessToken);
    res.json({ wabas });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/* ── Step 3: Listar phone numbers de una WABA (preview) ──── */

export async function listPhoneNumbers(req: Request, res: Response) {
  try {
    const { accessToken, wabaId } = req.body;
    if (!accessToken || !wabaId) return res.status(400).json({ error: "accessToken y wabaId requeridos" });
    const phones = await metaOAuth.getPhoneNumbers(wabaId, accessToken);
    res.json({ phones });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/* ── FULL: Embedded Signup (todo el flujo en un solo call) ─ */

export async function completeSignup(req: Request, res: Response) {
  try {
    const { code, wabaId, verifyToken } = req.body;
    if (!code) return res.status(400).json({ error: "code requerido" });

    const result = await metaOAuth.completeEmbeddedSignup({ code, wabaId, verifyToken });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/* ── Get current config (sanitizado) ──────────────────── */

export async function getCurrentConfig(req: Request, res: Response) {
  try {
    const config = await prisma.whatsappConfig.findFirst();
    if (!config) return res.json({ configured: false });

    // Don't expose encrypted tokens
    res.json({
      configured: true,
      id: config.id,
      phoneNumberId: config.phoneNumberId,
      status: config.status,
      lastPing: config.lastPing,
      webhookUrl: config.webhookUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/* ── Disconnect (eliminar config) ─────────────────────── */

export async function disconnect(req: Request, res: Response) {
  try {
    const config = await prisma.whatsappConfig.findFirst();
    if (!config) return res.json({ success: true, message: "Sin config" });
    await prisma.whatsappConfig.delete({ where: { id: config.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}