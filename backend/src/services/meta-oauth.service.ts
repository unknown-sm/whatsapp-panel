import axios from "axios";
import prisma from "../lib/prisma";
import { encrypt } from "./crypto.service";

/* ── Meta Embedded Signup OAuth flow ─────────────────── */

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";
const META_OAUTH_URL = "https://graph.facebook.com/v21.0/oauth/access_token";

interface ExchangeResult {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

interface PhoneNumber {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: string;
  codeVerificationStatus: string;
}

/* ── 1. Exchange code for access token ─────────────────── */

export async function exchangeCodeForToken(data: {
  code: string;
  appId?: string;
  appSecret?: string;
  redirectUri?: string;
}): Promise<ExchangeResult> {
  const appId = data.appId || process.env.META_APP_ID;
  const appSecret = data.appSecret || process.env.META_APP_SECRET;
  const redirectUri = data.redirectUri || process.env.META_REDIRECT_URI || "https://zwpkae.easypanel.host/settings";

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID y META_APP_SECRET no configurados (env vars)");
  }

  const params = new URLSearchParams();
  params.set("client_id", appId);
  params.set("client_secret", appSecret);
  params.set("code", data.code);
  if (data.redirectUri) params.set("redirect_uri", redirectUri);

  const res = await axios.post(META_OAUTH_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.data?.access_token) {
    throw new Error("Meta no devolvió access_token: " + JSON.stringify(res.data));
  }

  return {
    accessToken: res.data.access_token,
    expiresIn: res.data.expires_in || 0,
    tokenType: res.data.token_type || "bearer",
  };
}

/* ── 2. Get WABA (WhatsApp Business Account) IDs ──────── */

export async function getWABAs(accessToken: string) {
  const res = await axios.get(`${META_GRAPH_URL}/me/businesses`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { fields: "id,name,owned_whatsapp_business_accounts" },
  });

  return res.data.data || [];
}

export async function getWABA(wabaId: string, accessToken: string) {
  const res = await axios.get(`${META_GRAPH_URL}/${wabaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { fields: "id,name,phone_numbers{ id, display_phone_number, verified_name, code_verification_status, quality_rating }" },
  });
  return res.data;
}

/* ── 3. List phone numbers for a WABA ─────────────────── */

export async function getPhoneNumbers(wabaId: string, accessToken: string): Promise<PhoneNumber[]> {
  const res = await axios.get(`${META_GRAPH_URL}/${wabaId}/phone_numbers`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { fields: "id,display_phone_number,verified_name,quality_rating,code_verification_status" },
  });
  return res.data.data || [];
}

/* ── 4. Subscribe webhook to a phone number ────────────── */

export async function subscribeWebhook(phoneNumberId: string, accessToken: string, callbackUrl: string, verifyToken: string) {
  const res = await axios.post(
    `${META_GRAPH_URL}/${phoneNumberId}/subscribed_apps`,
    {
      webhook_url: callbackUrl,
      verify_token: verifyToken,
    },
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
  );
  return res.data;
}

/* ── 5. Full Embedded Signup flow ─────────────────────── */

export async function completeEmbeddedSignup(data: {
  code: string;
  wabaId?: string;       // Optional: user picks from list
  verifyToken?: string;  // Auto-generated if not provided
}) {
  // 1. Exchange code
  const { accessToken } = await exchangeCodeForToken({ code: data.code });

  // 2. List available WABAs
  const wabas = await getWABAs(accessToken);
  if (wabas.length === 0) {
    throw new Error("No se encontraron WhatsApp Business Accounts asociados a este usuario");
  }

  // 3. Pick WABA (use provided or first)
  const waba = data.wabaId ? wabas.find((w: any) => w.id === data.wabaId) : wabas[0];
  if (!waba) throw new Error("WABA no encontrada");

  // 4. List phone numbers
  const phoneNumbers = await getPhoneNumbers(waba.id, accessToken);
  if (phoneNumbers.length === 0) {
    throw new Error("WABA no tiene numeros de telefono");
  }

  // 5. Pick first verified phone number
  const phone = phoneNumbers.find((p) => p.codeVerificationStatus === "VERIFIED") || phoneNumbers[0];

  // 6. Generate verify token
  const verifyToken = data.verifyToken || `wpp-${Math.random().toString(36).slice(2, 10)}`;

  // 7. Subscribe webhook
  const baseUrl = process.env.WEBHOOK_BASE_URL || "https://zwpkae.easypanel.host";
  const callbackUrl = `${baseUrl}/webhook/incoming`;
  try {
    await subscribeWebhook(phone.id, accessToken, callbackUrl, verifyToken);
  } catch (err: any) {
    console.warn("Webhook subscribe failed (non-fatal):", err.response?.data || err.message);
  }

  // 8. Save config (encrypted)
  const encryptedToken = encrypt(accessToken);
  const encryptedVerify = encrypt(verifyToken);

  const existing = await prisma.whatsappConfig.findFirst();
  let config;
  if (existing) {
    config = await prisma.whatsappConfig.update({
      where: { id: existing.id },
      data: {
        phoneNumberId: phone.id,
        accessToken: encryptedToken,
        verifyToken: encryptedVerify,
        status: "online",
        lastPing: new Date(),
      },
    });
  } else {
    config = await prisma.whatsappConfig.create({
      data: {
        phoneNumberId: phone.id,
        accessToken: encryptedToken,
        verifyToken: encryptedVerify,
        webhookUrl: "/webhook/incoming",
        status: "online",
        lastPing: new Date(),
      },
    });
  }

  return {
    success: true,
    config: {
      id: config.id,
      phoneNumberId: phone.id,
      status: config.status,
    },
    waba: {
      id: waba.id,
      name: waba.name,
    },
    phoneNumber: {
      id: phone.id,
      displayPhoneNumber: phone.displayPhoneNumber,
      verifiedName: phone.verifiedName,
      qualityRating: phone.qualityRating,
    },
    webhookUrl: callbackUrl,
  };
}