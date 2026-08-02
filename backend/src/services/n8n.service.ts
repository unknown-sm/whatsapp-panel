import axios from "axios";
import prisma from "../lib/prisma";

async function getN8nConfig() {
  const key = await prisma.setting.findUnique({ where: { key: "n8n_api_key" } });
  const url = await prisma.setting.findUnique({ where: { key: "n8n_api_url" } });
  return {
    apiKey: key?.value || process.env.N8N_API_KEY || "",
    apiUrl: url?.value || process.env.N8N_API_URL || "https://n8n.seiva.com.py"
  };
}

export type N8nEventType =
  | "deal.won"
  | "deal.lost"
  | "deal.created"
  | "message.received"
  | "message.sent"
  | "lead_score.updated"
  | "followup.sent"
  | "contact.created"
  | "broadcast.completed";

export interface N8nEvent<T = any> {
  type: N8nEventType;
  orgId?: string;
  timestamp: string;
  data: T;
}

export async function emitN8nEvent<T>(type: N8nEventType, data: T, orgId?: string): Promise<void> {
  const { apiKey, apiUrl } = await getN8nConfig();
  if (!apiKey) return;

  const event: N8nEvent<T> = { type, orgId, timestamp: new Date().toISOString(), data };

  try {
    await axios.post(`${apiUrl}/webhook/crm-events`, event, {
      headers: { "X-N8N-API-KEY": apiKey, "X-N8n-Event": type, "Content-Type": "application/json" },
      timeout: 5000,
    });
  } catch (err: any) {
    console.error(`[N8N] Error emitiendo evento ${type}:`, err.message);
  }
}
