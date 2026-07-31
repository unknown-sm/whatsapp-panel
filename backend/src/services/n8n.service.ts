import axios from "axios";

const N8N_API_URL = process.env.N8N_API_URL || "https://n8n.seiva.com.py";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

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
  if (!N8N_API_KEY) return;

  const event: N8nEvent<T> = {
    type,
    orgId,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    await axios.post(`${N8N_API_URL}/webhook/crm-events`, event, {
      headers: {
        "X-N8N-API-KEY": N8N_API_KEY,
        "X-N8n-Event": type,
        "Content-Type": "application/json",
      },
      timeout: 5000,
    });
  } catch (err: any) {
    console.error(`[N8N] Error emitiendo evento ${type}:`, err.message);
  }
}
