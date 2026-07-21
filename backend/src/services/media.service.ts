import axios from "axios";
import path from "path";
import fs from "fs";
import prisma from "../lib/prisma";
import { decrypt, isEncrypted } from "./crypto.service";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ── Download media from Meta Graph API ─────────────────── */

interface MetaMedia {
  url: string;
  mimeType: string;
  sha256: string;
  fileSize: number;
  id: string;
}

export async function downloadMetaMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string; size: number } | null> {
  const config = await prisma.whatsappConfig.findFirst();
  if (!config) return null;

  const accessToken = isEncrypted(config.accessToken) ? decrypt(config.accessToken) : config.accessToken;

  try {
    // Step 1: get media URL from Meta
    const metaRes = await axios.get<MetaMedia>(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { url, mime_type, file_size } = metaRes.data as any;

    // Step 2: download binary
    const fileRes = await axios.get<Buffer>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer",
      maxContentLength: 50 * 1024 * 1024, // 50MB cap
    });

    return {
      buffer: Buffer.from(fileRes.data),
      mimeType: mime_type || "application/octet-stream",
      size: file_size || fileRes.data.length,
    };
  } catch (err: any) {
    console.error("Meta media download error:", err.response?.data || err.message);
    return null;
  }
}

/* ── Save to local uploads ─────────────────────────────── */

export async function saveMediaLocally(mediaId: string, mimeType: string): Promise<{
  localPath: string;
  url: string;
  filename: string;
  size: number;
} | null> {
  const downloaded = await downloadMetaMedia(mediaId);
  if (!downloaded) return null;

  const ext = mimeTypeToExt(mimeType);
  const filename = `${Date.now()}-${mediaId.slice(-6)}${ext}`;
  const fullPath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(fullPath, downloaded.buffer);

  return {
    localPath: fullPath,
    url: `/uploads/${filename}`,
    filename,
    size: downloaded.size,
  };
}

function mimeTypeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/ogg": ".ogg",
    "audio/ogg; codecs=opus": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/amr": ".amr",
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
  };
  return map[mime] || mime.split("/")[1]?.slice(0, 4) || ".bin";
}

/* ── Transcribe audio (OpenAI Whisper) ─────────────────── */

export async function transcribeAudioIfPossible(mediaId: string): Promise<string | null> {
  const downloaded = await downloadMetaMedia(mediaId);
  if (!downloaded) return null;

  // Find an OpenAI config
  const openaiConfig = await prisma.aIConfig.findFirst({
    where: { provider: "openai", isActive: true },
  });
  if (!openaiConfig) return null;

  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: openaiConfig.apiKey });
    const file = new File([downloaded.buffer], "audio.ogg", { type: downloaded.mimeType });
    const transcription = await openai.audio.transcriptions.create({
      file: file as any,
      model: "whisper-1",
      language: "es",
    });
    return transcription.text;
  } catch (err: any) {
    console.error("Whisper transcription error:", err.message);
    return null;
  }
}

/* ── Extract media info from Meta webhook payload ──────── */

export function extractMediaFromPayload(msg: any) {
  if (msg.type === "text") return null;
  const supported = ["image", "audio", "voice", "video", "document", "sticker"];
  if (!supported.includes(msg.type)) return null;

  const media = msg[msg.type]; // { id, mime_type, sha256, file_size, ... }
  return {
    type: msg.type,
    mediaId: media?.id,
    mimeType: media?.mime_type,
    sha256: media?.sha256,
    fileSize: media?.file_size,
    caption: media?.caption || "",
    filename: media?.filename,
  };
}
