import prisma from "../lib/prisma";
import path from "path";
import fs from "fs/promises";
import pdfParse from "pdf-parse";

export async function getBotKnowledge(botId: string) {
  return prisma.botKnowledge.findMany({
    where: { botId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addKnowledge(botId: string, file: Express.Multer.File) {
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

export async function deleteKnowledge(id: string) {
  return prisma.botKnowledge.delete({ where: { id } });
}

export async function getKnowledgeContent(botId: string): Promise<string> {
  const entries = await prisma.botKnowledge.findMany({
    where: { botId },
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
