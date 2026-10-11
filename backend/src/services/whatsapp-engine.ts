import axios from "axios";
import FormData from "form-data";
import prisma from "../lib/prisma";
import { decrypt, isEncrypted } from "./crypto.service";

/* Helper: get decrypted config */
async function getDecryptedConfig() {
  const config = await prisma.whatsappConfig.findFirst();
  if (!config) return null;
  return {
    ...config,
    accessToken: isEncrypted(config.accessToken) ? decrypt(config.accessToken) : config.accessToken,
    verifyToken: config.verifyToken && isEncrypted(config.verifyToken) ? decrypt(config.verifyToken) : config.verifyToken,
  };
}

export type MediaType = "image" | "video" | "document" | "audio" | "sticker";

export interface IWhatsAppEngine {
  sendText(phone: string, message: string): Promise<boolean>;
  sendMediaById(phone: string, mediaId: string, type: MediaType, caption?: string, filename?: string): Promise<boolean>;
  uploadMedia(buffer: Buffer, mimeType: string, filename: string): Promise<string | null>;
  sendMedia(phone: string, buffer: Buffer, mimeType: string, type: MediaType, caption?: string, filename?: string): Promise<boolean>;
  getStatus(): Promise<{ status: string; lastPing: string | null; configured: boolean }>;
}

export function resolveEngine(): IWhatsAppEngine {
  // Un solo canal: Meta Cloud API. OpenWA fue eliminado del stack.
  return new MetaEngine();
}

class MetaEngine implements IWhatsAppEngine {
  async sendText(phone: string, message: string): Promise<boolean> {
    const config = await getDecryptedConfig();
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

  async uploadMedia(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
    const config = await getDecryptedConfig();
    if (!config) return null;
    try {
      const form = new FormData();
      form.append("file", buffer, { contentType: mimeType, filename });
      form.append("messaging_product", "whatsapp");
      form.append("type", mimeType);

      const res = await axios.post(
        `https://graph.facebook.com/v21.0/${config.phoneNumberId}/media`,
        form,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            ...form.getHeaders(),
          },
          maxContentLength: 100 * 1024 * 1024,
        }
      );
      return res.data?.id || null;
    } catch (err: any) {
      console.error("Meta uploadMedia error:", err.response?.data || err.message);
      return null;
    }
  }

  async sendMediaById(phone: string, mediaId: string, type: MediaType, caption?: string, filename?: string): Promise<boolean> {
    const config = await getDecryptedConfig();
    if (!config) return false;
    try {
      const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
      const mediaObj: any = { id: mediaId };
      if (filename && type === "document") mediaObj.filename = filename;
      if (caption && (type === "image" || type === "video" || type === "document")) mediaObj.caption = caption;

      await axios.post(url, {
        messaging_product: "whatsapp",
        to: phone,
        type,
        [type]: mediaObj,
      }, {
        headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      });
      return true;
    } catch (err: any) {
      console.error("Meta sendMediaById error:", err.response?.data || err.message);
      return false;
    }
  }

  async sendMedia(phone: string, buffer: Buffer, mimeType: string, type: MediaType, caption?: string, filename?: string): Promise<boolean> {
    const mediaId = await this.uploadMedia(buffer, mimeType, filename || "file");
    if (!mediaId) return false;
    return this.sendMediaById(phone, mediaId, type, caption, filename);
  }

  async getStatus() {
    const config = await getDecryptedConfig();
    return { status: config?.status || "offline", lastPing: config?.lastPing?.toISOString() || null, configured: !!config?.phoneNumberId };
  }
}
