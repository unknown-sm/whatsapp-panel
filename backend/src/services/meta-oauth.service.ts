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
  /** Coexistence: el numero tambien esta en uso con la WhatsApp Business App */
  isOnBizApp: boolean;
  /** "CLOUD_API" | "WHATSAPP_BUSINESS_APP" */
  platformType: string | null;
}

/** Campos que Meta expone para detectar Coexistence (numero en App + Cloud API a la vez). */
const PHONE_FIELDS =
  "id,display_phone_number,verified_name,quality_rating,code_verification_status,is_on_biz_app,platform_type";

function toPhoneNumber(p: any): PhoneNumber {
  return {
    id: p.id,
    displayPhoneNumber: p.display_phone_number,
    verifiedName: p.verified_name,
    qualityRating: p.quality_rating,
    codeVerificationStatus: p.code_verification_status,
    isOnBizApp: p.is_on_biz_app === true,
    platformType: p.platform_type ?? null,
  };
}

/** Devuelve la URL publica donde Meta debe enviarnos los webhooks (ej. https://crm.seiva.com.py). */
function requireWebhookBaseUrl(): string {
  const base = (process.env.WEBHOOK_BASE_URL || "").replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "WEBHOOK_BASE_URL no configurada (env var). Definila con el dominio publico del CRM, ej. https://crm.seiva.com.py"
    );
  }
  return base;
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
  const redirectUri = data.redirectUri || process.env.META_REDIRECT_URI;

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID y META_APP_SECRET no configurados (env vars)");
  }

  const params = new URLSearchParams();
  params.set("client_id", appId);
  params.set("client_secret", appSecret);
  params.set("code", data.code);
  // Meta exige que coincida con el redirect_uri usado en el paso de autorizacion.
  if (redirectUri) params.set("redirect_uri", redirectUri);

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
    params: { fields: `id,name,phone_numbers{ ${PHONE_FIELDS} }` },
  });
  return res.data;
}

/* ── 3. List phone numbers for a WABA ─────────────────── */

export async function getPhoneNumbers(wabaId: string, accessToken: string): Promise<PhoneNumber[]> {
  const res = await axios.get(`${META_GRAPH_URL}/${wabaId}/phone_numbers`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { fields: PHONE_FIELDS },
  });
  return (res.data.data || []).map(toPhoneNumber);
}

/* ── 3b. Detalle de un numero (incluye Coexistence) ─────── */

export interface PhoneNumberDetails extends PhoneNumber {
  coexistence: boolean;
}

/**
 * Lee el estado de Coexistence de un numero.
 * is_on_biz_app=true + platform_type=CLOUD_API => el numero corre a la vez en la
 * WhatsApp Business App (celular) y en Cloud API (este CRM).
 *
 * Los campos is_on_biz_app/platform_type no existen en todas las versiones de la
 * Graph API, asi que si la peticion falla reintentamos sin ellos: detectar
 * Coexistence es "nice to have" y nunca debe romper la conexion.
 */
export async function getPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string
): Promise<PhoneNumberDetails> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  let data: any;
  try {
    const res = await axios.get(`${META_GRAPH_URL}/${phoneNumberId}`, {
      headers,
      params: { fields: PHONE_FIELDS },
    });
    data = res.data;
  } catch {
    const res = await axios.get(`${META_GRAPH_URL}/${phoneNumberId}`, {
      headers,
      params: {
        fields: "id,display_phone_number,verified_name,quality_rating,code_verification_status",
      },
    });
    data = res.data;
  }
  const base = toPhoneNumber(data);
  return { ...base, coexistence: base.isOnBizApp && base.platformType === "CLOUD_API" };
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
  code?: string;
  /** Reutiliza un access token ya canjeado (fase 2 del flujo con selector de numero). */
  accessToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
  verifyToken?: string;
}) {
  // 1. Resolve token. El `code` de OAuth solo puede canjearse UNA vez, asi que el
  //    flujo con selector de numero lo canjea primero (POST /exchange) y aca se
  //    reutiliza el accessToken.
  let accessToken = data.accessToken;
  if (!accessToken) {
    if (!data.code) throw new Error("code o accessToken requerido");
    accessToken = (await exchangeCodeForToken({ code: data.code })).accessToken;
  }

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

  // 5. Pick the requested number, or the first verified one
  const phone =
    (data.phoneNumberId && phoneNumbers.find((p) => p.id === data.phoneNumberId)) ||
    phoneNumbers.find((p) => p.codeVerificationStatus === "VERIFIED") ||
    phoneNumbers[0];

  // 6. Generate verify token
  const verifyToken = data.verifyToken || `wpp-${Math.random().toString(36).slice(2, 10)}`;

  // 7. Subscribe webhook.
  //    Meta exige la URL completa publica. Ruta real: POST /webhook (ver whatsapp.routes.ts).
  //    Antes apuntaba a /webhook/incoming (404) y el fallo se tragaba con console.warn,
  //    lo que dejaba al signup "exitoso" pero sin webhooks.
  const callbackUrl = `${requireWebhookBaseUrl()}/webhook`;
  let webhookSubscribed = false;
  let webhookError: string | null = null;
  try {
    await subscribeWebhook(phone.id, accessToken, callbackUrl, verifyToken);
    webhookSubscribed = true;
  } catch (err: any) {
    // No fatal: el config se guarda igual y el usuario puede suscribir el webhook
    // a mano en Meta. Pero el error se propaga a la UI en vez de perderse.
    webhookError = err.response?.data?.error?.message || err.response?.data?.error?.error_user_msg || err.message;
    console.error("[EMBEDDED-SIGNUP] subscribeWebhook fallo:", err.response?.status, webhookError);
  }

  // 7b. Leer estado de Coexistence del numero elegido
  let details: PhoneNumberDetails | null = null;
  try {
    details = await getPhoneNumberDetails(phone.id, accessToken);
  } catch (err: any) {
    console.warn("[EMBEDDED-SIGNUP] No se pudo leer is_on_biz_app/platform_type:", err.message);
  }
  const coexistence = details?.coexistence ?? false;

  // 8. Save config (encrypted)
  const encryptedToken = encrypt(accessToken);
  const encryptedVerify = encrypt(verifyToken);

  const existing = await prisma.whatsappConfig.findFirst();
  const configData = {
    phoneNumberId: phone.id,
    accessToken: encryptedToken,
    verifyToken: encryptedVerify,
    webhookUrl: callbackUrl,
    status: "online" as const,
    lastPing: new Date(),
    isOnBizApp: details?.isOnBizApp ?? false,
    platformType: details?.platformType ?? null,
    displayPhoneNumber: details?.displayPhoneNumber ?? phone.displayPhoneNumber ?? null,
    verifiedName: details?.verifiedName ?? phone.verifiedName ?? null,
    qualityRating: details?.qualityRating ?? phone.qualityRating ?? null,
  };
  const config = existing
    ? await prisma.whatsappConfig.update({ where: { id: existing.id }, data: configData })
    : await prisma.whatsappConfig.create({ data: configData });

  return {
    success: true,
    config: {
      id: config.id,
      phoneNumberId: phone.id,
      status: config.status,
      webhookUrl: callbackUrl,
    },
    waba: {
      id: waba.id,
      name: waba.name,
      phoneNumbers: phoneNumbers.map((p) => ({
        id: p.id,
        displayPhoneNumber: p.displayPhoneNumber,
        verifiedName: p.verifiedName,
        qualityRating: p.qualityRating,
        codeVerificationStatus: p.codeVerificationStatus,
        isOnBizApp: p.isOnBizApp,
        platformType: p.platformType,
      })),
    },
    phoneNumber: {
      id: phone.id,
      displayPhoneNumber: details?.displayPhoneNumber ?? phone.displayPhoneNumber,
      verifiedName: details?.verifiedName ?? phone.verifiedName,
      qualityRating: details?.qualityRating ?? phone.qualityRating,
    },
    coexistence,
    webhookUrl: callbackUrl,
    webhookSubscribed,
    webhookError,
  };
}
