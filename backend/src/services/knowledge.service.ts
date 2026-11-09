import prisma from "../lib/prisma";
import path from "path";
import fs from "fs/promises";
import pdfParse from "pdf-parse";

// botId null = conocimiento global (todos los bots lo comparten)

export async function getBotKnowledge(botId: string | null) {
  // Lista el conocimiento del bot + el global, para que el editor muestre todo
  return prisma.botKnowledge.findMany({
    where: botId ? { OR: [{ botId }, { botId: null }] } : { botId: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function addKnowledge(botId: string | null, file: Express.Multer.File) {
  const content = await extractText(file);
  return prisma.botKnowledge.create({
    data: {
      botId,
      filename: file.originalname,
      mimeType: file.mimetype,
      content: content.slice(0, 50000),
      size: file.size,
    },
  });
}

/** Importa una pagina web como conocimiento: baja el HTML y extrae el texto. */
export async function addKnowledgeFromUrl(botId: string | null, url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    throw new Error("URL invalida");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL invalida");

  const res = await fetch(parsed.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SeivaCRM-Bot/1.0)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`La pagina respondio ${res.status}`);
  const html = await res.text();
  const content = buildWebKnowledge(html, parsed);

  return prisma.botKnowledge.create({
    data: {
      botId,
      filename: parsed.hostname + (parsed.pathname === "/" ? "" : parsed.pathname),
      mimeType: "text/html",
      content,
      size: Buffer.byteLength(content, "utf8"),
    },
  });
}

/** Conserva el origen y las imágenes públicas para respuestas de producto. */
export function buildWebKnowledge(html: string, pageUrl: URL): string {
  const text = htmlToText(html);
  if (text.length < 50) throw new Error("No se pudo extraer texto util de la pagina");

  const candidates: string[] = [];
  for (const match of html.matchAll(/<meta\b[^>]*(?:property|name)=["']og:image["'][^>]*>/gi)) {
    candidates.push(match[0].match(/\bcontent=["']([^"']+)["']/i)?.[1] || "");
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    candidates.push(match[0].match(/\b(?:src|data-src)=["']([^"']+)["']/i)?.[1] || "");
  }

  const images = [...new Set(candidates.map((candidate) => {
    try {
      const url = new URL(candidate.replace(/&amp;/g, "&"), pageUrl);
      if (!["http:", "https:"].includes(url.protocol)) return null;
      if (/logo|icon|favicon|sprite|placeholder/i.test(url.pathname)) return null;
      return url.toString();
    } catch {
      return null;
    }
  }).filter((url): url is string => !!url))].slice(0, 30);

  const mediaContext = [
    `PAGINA_ORIGEN: ${pageUrl.toString()}`,
    ...(images.length ? ["IMAGENES_PRODUCTO:", ...images.map((url) => `- ${url}`)] : []),
  ].join("\n");
  return `${mediaContext}\n\n${text}`.slice(0, 50000);
}

export async function deleteKnowledge(id: string) {
  return prisma.botKnowledge.delete({ where: { id } });
}

export async function getKnowledgeContent(botId?: string | null): Promise<string> {
  const entries = await prisma.botKnowledge.findMany({
    where: botId ? { OR: [{ botId: null }, { botId }] } : { botId: null },
    orderBy: { createdAt: "desc" },
  });
  if (entries.length === 0) return "";
  return entries
    .map((k: { filename: string; content: string }) => `--- ${k.filename} ---\n${k.content}`)
    .join("\n\n");
}

async function extractText(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase();
  try {
    if (ext === ".pdf") {
      const data = await pdfParse(file.buffer);
      return data.text;
    }
    if (ext === ".docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    }
    if (ext === ".json") {
      const obj = JSON.parse(file.buffer.toString("utf-8"));
      return JSON.stringify(obj, null, 2);
    }
    return file.buffer.toString("utf-8");
  } catch (e) {
    console.error("Error extracting text from", file.originalname, e);
    return file.buffer.toString("utf-8").slice(0, 50000);
  }
}

/** HTML -> texto plano: saca scripts/estilos/tags y colapsa espacios. */
function htmlToText(html: string): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|br|header|footer|nav)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  t = t
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  return t
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
