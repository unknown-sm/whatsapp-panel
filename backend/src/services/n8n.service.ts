import axios from "axios";

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "";

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
  if (!N8N_WEBHOOK_URL) return;

  const event: N8nEvent<T> = {
    type,
    orgId,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    await axios.post(N8N_WEBHOOK_URL, event, {
      headers: { "X-N8n-Event": type },
      timeout: 5000,
    });
  } catch (err: any) {
    console.error(`[N8N] Error emitiendo evento ${type}:`, err.message);
  }
}
