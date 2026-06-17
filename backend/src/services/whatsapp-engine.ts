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
  private baseUrl = process.env.OPENWA_BASE_URL || "http://openwa:2785";
  private apiKey = process.env.OPENWA_API_KEY || "";

  private getHeaders() {
    return { "x-api-key": this.apiKey, "Content-Type": "application/json" };
  }

  async sendText(phone: string, message: string): Promise<boolean> {
    try {
      await axios.post(`${this.baseUrl}/sendText`, { phone, message }, { headers: this.getHeaders() });
      return true;
    } catch (error: any) {
      console.error("OpenWA sendText error:", error.response?.data || error.message);
      return false;
    }
  }

  async sendMedia(phone: string, mediaId: string, type: "image" | "video" | "document"): Promise<boolean> {
    try {
      const mediaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
      await axios.post(`${this.baseUrl}/sendImage`, { phone, mediaUrl }, { headers: this.getHeaders() });
      return true;
    } catch (error: any) {
      console.error("OpenWA sendMedia error:", error.response?.data || error.message);
      return false;
    }
  }

  async getStatus() {
    try {
      const { data } = await axios.get(`${this.baseUrl}/session/status`, { headers: this.getHeaders() });
      return { status: data.status || "unknown", lastPing: null, configured: !!this.apiKey };
    } catch {
      return { status: "offline", lastPing: null, configured: !!this.apiKey };
    }
  }
}
