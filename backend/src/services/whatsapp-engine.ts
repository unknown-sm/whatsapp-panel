import axios from "axios";
import prisma from "../lib/prisma";

export interface IWhatsAppEngine {
  sendText(phone: string, message: string): Promise<boolean>;
  sendMedia(phone: string, mediaId: string, type: "image" | "video" | "document"): Promise<boolean>;
  getStatus(): Promise<{ status: string; lastPing: string | null; configured: boolean }>;
}

export function resolveEngine(): IWhatsAppEngine {
  const engine = process.env.WHATSAPP_ENGINE || "meta";
  if (engine === "openwa") return new OpenWAEngine();
  return new MetaEngine();
}

class MetaEngine implements IWhatsAppEngine {
  async sendText(phone: string, message: string): Promise<boolean> {
    const config = await prisma.whatsappConfig.findFirst();
    if (!config) {
      console.error("Meta: WhatsApp config not found");
      return false;
    }
    try {
      const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
      await axios.post(url, {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      }, {
        headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      });
      return true;
    } catch (error: any) {
      console.error("Meta send error:", error.response?.data || error.message);
      return false;
    }
  }

  async sendMedia(phone: string, mediaId: string, type: "image" | "video" | "document"): Promise<boolean> {
    const config = await prisma.whatsappConfig.findFirst();
    if (!config) return false;
    try {
      const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
      await axios.post(url, { messaging_product: "whatsapp", to: phone, type, [type]: { id: mediaId } }, {
        headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      });
      return true;
    } catch { return false; }
  }

  async getStatus() {
    const config = await prisma.whatsappConfig.findFirst();
    return { status: config?.status || "offline", lastPing: config?.lastPing?.toISOString() || null, configured: !!config?.phoneNumberId };
  }
}

class OpenWAEngine implements IWhatsAppEngine {
  private baseUrl = process.env.OPENWA_URL || "http://openwa:2785";
  private apiKey = process.env.OPENWA_API_KEY || "";

  private async getSessionId(): Promise<string> {
    const config = await prisma.openwaConfig.findFirst();
    return config?.sessionId || "";
  }

  private async api(method: string, path: string, data?: any) {
    try {
      const res = await axios({
        method,
        url: `${this.baseUrl}/api${path}`,
        data,
        headers: { "X-API-Key": this.apiKey, "Content-Type": "application/json" },
        timeout: 15000,
      });
      return res.data;
    } catch (error: any) {
      console.error("OpenWA API error:", error.response?.data || error.message);
      return null;
    }
  }

  async sendText(phone: string, message: string): Promise<boolean> {
    const sessionId = await this.getSessionId();
    if (!sessionId) { console.error("OpenWA: no active session"); return false; }
    const chatId = `${phone}@c.us`;
    const result = await this.api("post", `/sessions/${sessionId}/messages/send-text`, { chatId, text: message });
    return !!result?.messageId;
  }

  async sendMedia(phone: string, url: string, type: "image" | "video" | "document"): Promise<boolean> {
    const sessionId = await this.getSessionId();
    if (!sessionId) return false;
    const chatId = `${phone}@c.us`;
    const typeMap: Record<string, string> = { image: "send-image", video: "send-video", document: "send-document" };
    const endpoint = typeMap[type] || "send-document";
    const result = await this.api("post", `/sessions/${sessionId}/messages/${endpoint}`, { chatId, url });
    return !!result?.messageId;
  }

  async getStatus() {
    const sessionId = await this.getSessionId();
    try {
      const res = await this.api("get", `/sessions/${sessionId}`);
      return { status: res?.status || "disconnected", lastPing: res?.lastActiveAt || null, configured: !!sessionId };
    } catch { return { status: "disconnected", lastPing: null, configured: false }; }
  }
}
