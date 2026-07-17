import prisma from "../lib/prisma";
import { z } from "zod";
import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { getKnowledgeContent } from "./knowledge.service";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const OPENCODE_BASE_URL = "https://api.opencode.ai/v1";

export async function getAIConfigs() {
  return prisma.aIConfig.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createAIConfig(data: any) {
  const parsed = z.object({
    name: z.string().min(1),
    provider: z.enum(["openai", "anthropic", "nvidia", "deepseek", "opencode", "custom"]),
    apiKey: z.string().min(1),
    model: z.string().min(1),
    endpoint: z.string().optional(),
  }).parse(data);

  // If setting as default, unset others
  if (["openai", "anthropic", "nvidia"].includes(parsed.provider)) {
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

export async function generateResponse(
  configId: string,
  messages: { role: string; content: string }[],
  options?: { systemPrompt?: string; maxTokens?: number; botId?: string }
): Promise<string> {
  const config = await prisma.aIConfig.findUnique({ where: { id: configId } });
  if (!config) throw new Error("AI config not found");

  let systemPrompt = options?.systemPrompt || "";
  const maxTokens = options?.maxTokens || 1024;

  if (options?.botId) {
    const knowledge = await getKnowledgeContent(options.botId);
    if (knowledge) {
      systemPrompt += `\n\n## Conocimiento del negocio\n${knowledge}`;
    }
  }

  if (config.provider === "openai") {
    const openai = new OpenAI({ apiKey: config.apiKey });
    const chatMessages: any[] = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    if (!systemPrompt) {
      systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    }
    if (systemPrompt) {
      chatMessages.unshift({ role: "system", content: systemPrompt });
    }
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: chatMessages,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || "";
  }

  if (config.provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey: config.apiKey });
    const chatMessages = messages.filter((m) => m.role !== "system");
    if (!systemPrompt) {
      systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    }

    const response = await anthropic.messages.create({
      model: config.model as any,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: chatMessages.map((m) => ({ role: m.role as any, content: m.content })),
    });
    return response.content[0]?.type === "text" ? response.content[0].text : "";
  }

  if (config.provider === "nvidia") {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: NVIDIA_BASE_URL });
    const chatMessages: any[] = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    if (!systemPrompt) {
      systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    }
    if (systemPrompt) {
      chatMessages.unshift({ role: "system", content: systemPrompt });
    }
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: chatMessages,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || "";
  }

  // OpenCode Zen (OpenAI-compatible API)
  if (config.provider === "opencode") {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: OPENCODE_BASE_URL });
    const chatMessages: any[] = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    if (!systemPrompt) {
      systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    }
    if (systemPrompt) {
      chatMessages.unshift({ role: "system", content: systemPrompt });
    }
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: chatMessages,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || "";
  }

  // DeepSeek (OpenAI-compatible API)
  if (config.provider === "deepseek") {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: DEEPSEEK_BASE_URL });
    const chatMessages: any[] = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    if (!systemPrompt) {
      systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    }
    if (systemPrompt) {
      chatMessages.unshift({ role: "system", content: systemPrompt });
    }
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: chatMessages,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || "";
  }

  // Custom endpoint (OpenAI-compatible)
  if (config.endpoint) {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.endpoint });
    const chatMessages: any[] = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    if (!systemPrompt) {
      systemPrompt = messages.find((m) => m.role === "system")?.content || "";
    }
    if (systemPrompt) {
      chatMessages.unshift({ role: "system", content: systemPrompt });
    }
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: chatMessages,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || "";
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
  } else if (config.provider === "nvidia") {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: NVIDIA_BASE_URL });
    const res = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
    });
    response = res.choices[0]?.message?.content || "";
  } else if (config.provider === "deepseek") {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: DEEPSEEK_BASE_URL });
    const res = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
    });
    response = res.choices[0]?.message?.content || "";
  } else if (config.provider === "opencode") {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: OPENCODE_BASE_URL });
    const res = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
    });
    response = res.choices[0]?.message?.content || "";
  } else if (config.endpoint) {
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.endpoint });
    const res = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
    });
    response = res.choices[0]?.message?.content || "";
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

/* ── AI Suggest Responses (Inbox 3-columnas) ──────────── */

export async function suggestResponses(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: {
        include: {
          tags: { include: { tag: true } },
          adAttributions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      bot: true,
      messages: { orderBy: { timestamp: "desc" }, take: 30 },
    },
  });

  if (!conversation) throw new Error("Conversacion no encontrada");

  const config = await prisma.aIConfig.findFirst({
    where: { isActive: true, isDefault: true },
  });
  if (!config) {
    return { suggestions: [], error: "no_ai_config" };
  }

  const scores = await prisma.leadScore.aggregate({
    where: { contactId: conversation.contactId },
    _sum: { points: true },
  });
  const leadScore = scores._sum.points || 0;

  let knowledge = "";
  if (conversation.bot) {
    try { knowledge = await getKnowledgeContent(conversation.botId!); } catch {}
  }

  const messages = conversation.messages.slice(0, 20).reverse();
  const tagList = conversation.contact.tags.map((ct) => ct.tag.name).join(", ") || "ninguna";
  const attribution = conversation.contact.adAttributions[0];

  const systemPrompt = `Eres un asistente de ventas que ayuda a un agente humano a responder mensajes de WhatsApp.

CONTEXTO DEL CONTACTO:
- Nombre: ${conversation.contact.name || "Sin nombre"}
- Telefono: ${conversation.contact.phone}
- Etiquetas: ${tagList}
- Lead score: ${leadScore} puntos${attribution ? `\n- Fuente: anuncio de ${attribution.source} (campana: ${attribution.campaign || "N/A"})` : "\n- Fuente: organico"}

CONTEXTO DE LA CONVERSACION:
- Estado: ${conversation.status}
- Bot activo: ${conversation.bot?.name || "ninguno"}
${conversation.bot?.systemPrompt ? `- Instrucciones del bot: ${conversation.bot.systemPrompt}` : ""}

${knowledge ? `CONOCIMIENTO DEL NEGOCIO:\n${knowledge.substring(0, 1500)}\n` : ""}

INSTRUCCIONES:
- Genera EXACTAMENTE 3 respuestas sugeridas en espanol
- Cada respuesta debe ser corta (max 150 caracteres), conversacional y natural para WhatsApp
- Las 3 respuestas deben tener diferentes tonos: una directa, una mas consultiva, una con pregunta abierta
- NO incluyas saludos innecesarios si la conversacion ya esta avanzada
- Si hay objection de precio, una respuesta debe abordar el valor
- Si el cliente esta indeciso, una respuesta debe ayudar a avanzar

Responde SOLO con un JSON array, sin markdown, sin explicaciones:
[
  {"text": "respuesta directa", "tone": "directa", "reasoning": "porque es directa"},
  {"text": "respuesta consultiva", "tone": "consultiva", "reasoning": "porque es consultiva"},
  {"text": "respuesta con pregunta", "tone": "abierta", "reasoning": "porque hace una pregunta"}
]`;

  const chatMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.content })),
  ];

  try {
    const response = await generateResponse(config.id, chatMessages, { maxTokens: 600 });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return {
        suggestions: [
          { id: "1", text: response.substring(0, 150).trim(), tone: "directa", reasoning: "Generada por IA" },
          { id: "2", text: response.substring(0, 150).trim(), tone: "alternativa", reasoning: "Generada por IA" },
        ],
        context: { leadScore, hasAttribution: !!attribution, hasKnowledge: !!knowledge },
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      suggestions: parsed.map((s: any, i: number) => ({
        id: `sug-${i}`,
        text: s.text || "",
        tone: s.tone || "neutral",
        reasoning: s.reasoning || "",
      })).filter((s: any) => s.text).slice(0, 3),
      context: { leadScore, hasAttribution: !!attribution, hasKnowledge: !!knowledge },
    };
  } catch (err: any) {
    return { suggestions: [], error: err.message };
  }
}
