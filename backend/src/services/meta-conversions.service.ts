import axios from "axios";
import crypto from "crypto";

const PIXEL_ID = process.env.META_PIXEL_ID || "";
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "";
const API_VERSION = "v22.0";

function hash(data: string): string {
  return crypto.createHash("sha256").update(data.trim().toLowerCase()).digest("hex");
}

async function sendEvent(eventName: string, eventTime: number, userData: any, customData?: any, eventSourceUrl?: string) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.log("[Meta] META_PIXEL_ID o META_ACCESS_TOKEN no configurados, evento ignorado");
    return;
  }

  const payload = {
    data: [{
      event_name: eventName,
      event_time: eventTime,
      action_source: "website",
      event_source_url: eventSourceUrl || process.env.FRONTEND_URL || "https://crm.seiva.com.py",
      user_data: userData,
      custom_data: customData,
    }],
    test_event_code: process.env.META_TEST_EVENT_CODE || undefined,
  };

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    await axios.post(url, payload);
    console.log(`[Meta] Evento ${eventName} enviado correctamente`);
  } catch (err: any) {
    console.error(`[Meta] Error enviando ${eventName}:`, err.response?.data || err.message);
  }
}

export async function sendPurchaseEvent(data: {
  contactPhone: string;
  contactName?: string;
  dealValue: number;
  dealName: string;
  currency?: string;
  adId?: string;
  campaignId?: string;
  eventSourceUrl?: string;
}) {
  const userData: any = {};
  if (data.contactPhone) {
    userData.phone = [hash(data.contactPhone)];
    userData.ph = [hash(data.contactPhone)];
  }
  if (data.contactName) {
    userData.fn = [hash(data.contactName.split(" ")[0])];
    userData.ln = [hash(data.contactName.split(" ").slice(1).join(" ") || data.contactName)];
  }
  if (data.adId) {
    const fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${Date.now()}`;
    userData.fbc = fbc;
  }

  const customData: any = {
    value: data.dealValue,
    currency: data.currency || "USD",
    content_name: data.dealName,
  };

  await sendEvent("Purchase", Math.floor(Date.now() / 1000), userData, customData, data.eventSourceUrl);
}

export async function sendLeadEvent(data: {
  contactPhone: string;
  contactName?: string;
  eventSourceUrl?: string;
}) {
  const userData: any = {};
  if (data.contactPhone) {
    userData.phone = [hash(data.contactPhone)];
  }
  if (data.contactName) {
    userData.fn = [hash(data.contactName.split(" ")[0])];
  }
  await sendEvent("Lead", Math.floor(Date.now() / 1000), userData, undefined, data.eventSourceUrl);
}
