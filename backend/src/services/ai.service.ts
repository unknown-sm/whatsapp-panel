import prisma from "../lib/prisma";
import { z } from "zod";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";

export async function getAIConfigs() {
  return prisma.aIConfig.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createAIConfig(data: any) {
  const parsed = z.object({
    name: z.string().min(1),
    provider: z.enum(["openai", "anthropic", "custom"]),
    apiKey: z.string().min(1),
    model: z.string().min(1),
    endpoint: z.string().optional(),
  }).parse(data);

  // If setting as default, unset others
  if (parsed.provider === "openai" || parsed.provider === "anthropic") {
    await prisma.aIConfig.updateMany({
      where: { provider: parsed.provider, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.aIConfig.create({ data: { ...parsed, isDefault: true } });
}

export async function updateAIConfig(id: string, data: any) {
  return prisma.aIConfig.update({ where: { id }, data });
}

export async function deleteAIConfig(id: string) {
  return prisma.aIConfig.delete({ where: { id } });
}

export async function setDefault(id: string) {
  const config = await prisma.aIConfig.findUnique({ where: { id } });
  if (!config) throw new Error("Config not found");

  await prisma.aIConfig.updateMany({
    where: { provider: config.provider, isDefault: true },
    data: { isDefault: false },
  });

  return prisma.aIConfig.update({ where: { id }, data: { isDefault: true } });
}

export async function generateResponse(configId: string, messages: { role: string; content: string }[]): Promise<string> {
  const config = await prisma.aIConfig.findUnique({ where: { id: configId } });
  if (!config) throw new Error("AI config not found");

  if (config.provider === "openai") {
    const openai = new OpenAI({ apiKey: config.apiKey });
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role as any, content: m.content })),
      max_tokens: 1024,
    });
    return response.choices[0]?.message?.content || "";
  }

  if (config.provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey: config.apiKey });
    const systemMessage = messages.find((m) => m.role === "system")?.content || "";
    const chatMessages = messages.filter((m) => m.role !== "system");

    const response = await anthropic.messages.create({
      model: config.model as any,
      max_tokens: 1024,
      system: systemMessage,
      messages: chatMessages.map((m) => ({ role: m.role as any, content: m.content })),
    });
    return response.content[0]?.type === "text" ? response.content[0].text : "";
  }

  // Custom endpoint
  if (config.endpoint) {
    const axios = await import("axios");
    const response = await axios.default.post(config.endpoint, {
      model: config.model,
      messages,
      api_key: config.apiKey,
    });
    return response.data.choices?.[0]?.message?.content || response.data.response || "";
  }

  throw new Error("Unsupported AI provider");
}

export async function classifyIntent(configId: string, text: string, intents: { label: string; samples: string[] }[]): Promise<{ label: string; confidence: number }> {
  const config = await prisma.aIConfig.findUnique({ where: { id: configId } });
  if (!config) throw new Error("AI config not found");

  const intentDescriptions = intents.map((i) =>
    `- "${i.label}": ejemplos: ${i.samples.join(", ")}`
  ).join("\n");

  const prompt = `Clasifica el siguiente mensaje en una de estas intenciones:

${intentDescriptions}

Mensaje: "${text}"

Responde solo con el label de la intencion y un numero de confianza entre 0 y 1.
Formato: label|confidence`;

  let response = "";
  if (config.provider === "openai") {
    const openai = new OpenAI({ apiKey: config.apiKey });
    const res = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
    });
    response = res.choices[0]?.message?.content || "";
  } else if (config.provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey: config.apiKey });
    const res = await anthropic.messages.create({
      model: config.model as any,
      max_tokens: 50,
      messages: [{ role: "user", content: prompt }],
    });
    response = res.content[0]?.type === "text" ? res.content[0].text : "";
  }

  const [label, confidenceStr] = response.split("|");
  const confidence = parseFloat(confidenceStr) || 0.5;

  return { label: label?.trim() || "unknown", confidence };
}

export async function transcribeAudio(configId: string, audioBuffer: Buffer): Promise<string> {
  const config = await prisma.aIConfig.findUnique({ where: { id: configId } });
  if (!config || config.provider !== "openai") {
    throw new Error("Transcripcion solo disponible con OpenAI (Whisper)");
  }

  const openai = new OpenAI({ apiKey: config.apiKey });
  const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
  const transcription = await openai.audio.transcriptions.create({
    file: blob as any,
    model: "whisper-1",
  });

  return transcription.text;
}
