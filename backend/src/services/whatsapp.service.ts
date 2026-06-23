import axios from "axios";
import prisma from "../lib/prisma";
import { io } from "../index";
import { generateResponse, classifyIntent } from "./ai.service";
import { resolveEngine } from "./whatsapp-engine";
import { findBotByKeyword } from "./bot.service";
import { addScoreByCondition } from "./leadscore.service";
import * as sessionService from "./session.service";
import * as attributionService from "./attribution.service";

const engine = resolveEngine();

export async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  return engine.sendText(phoneNumber, message);
}

export async function sendWhatsAppMedia(phoneNumber: string, mediaId: string, type: "image" | "video" | "document"): Promise<boolean> {
  return engine.sendMedia(phoneNumber, mediaId, type);
}

export async function processIncomingMessage(data: any) {
  const entry = data.entry?.[0];
  if (!entry) return;

  const changes = entry.changes || [];
  for (const change of changes) {
    const value = change.value;
    const messages = value.messages || [];

    for (const msg of messages) {
      if (msg.type !== "text") continue;

      const phone = msg.from;
      const text = msg.text?.body || "";

      let contact = await prisma.contact.findUnique({ where: { phone } });
      if (!contact) {
        contact = await prisma.contact.create({ data: { phone } });
      }

      await prisma.contact.update({ where: { id: contact.id }, data: { lastActivity: new Date() } });

      // Session Manager: track 24h window
      sessionService.trackInbound(contact.id).catch(() => {});

      // Attribution: parse ref parameter from CTWA ads
      const ref = data.ref || data.entry?.[0]?.changes?.[0]?.value?.ref;
      if (ref) {
        attributionService.parseRefAndTrack(contact.id, ref, data.metadata).catch(() => {});
      }

      let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, status: "active" },
        orderBy: { updatedAt: "desc" },
      });

      if (!conversation) {
        const matchedBot = await findBotByKeyword(text);

        conversation = await prisma.conversation.create({
          data: { contactId: contact.id, botId: matchedBot?.id || null, status: matchedBot ? "active" : "waiting_agent" },
        });
      }

      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "inbound", type: "text", content: text },
      });

      // Lead scoring: MESSAGE_RECEIVED
      addScoreByCondition(contact.id, "MESSAGE_RECEIVED", "Mensaje recibido por WhatsApp").catch(() => {});

      // Lead scoring: KEYWORD_MATCHED if bot matched
      if (conversation.botId) {
        addScoreByCondition(contact.id, "KEYWORD_MATCHED", `Keyword detectada: "${text.substring(0, 50)}"`).catch(() => {});
      }

      io.emit("message:new", {
        conversationId: conversation.id,
        phone,
        content: text,
        direction: "inbound",
        timestamp: new Date().toISOString(),
      });

      io.emit("conversation:updated", {
        id: conversation.id,
        contactId: contact.id,
        phone,
        lastMessage: text,
        updatedAt: new Date().toISOString(),
      });

      if (conversation.botId && conversation.status === "active") {
        await processBotFlow(conversation, text);
      }
    }
  }
}

async function processBotFlow(conversation: any, userMessage: string) {
  const bot = await prisma.bot.findUnique({
    where: { id: conversation.botId },
    include: {
      flowSteps: {
        orderBy: { order: "asc" },
        include: { httpRoutes: true, intentRoutes: true },
      },
    },
  });

  if (!bot || bot.flowSteps.length === 0) return;

  const contextVars = (conversation.contextVars as any) || {};
  const currentStepIndex = contextVars.currentStepIndex || 0;

  if (currentStepIndex >= bot.flowSteps.length) return;

  const step = bot.flowSteps[currentStepIndex];

  if (step.responseCapture && userMessage) {
    contextVars[step.responseCapture] = userMessage;
  }

  switch (step.stepType) {
    case "TEXT":
      if (step.message) {
        const contact = await prisma.contact.findUnique({ where: { id: conversation.contactId } });
        if (contact) {
          await sendWhatsAppMessage(contact.phone, step.message);
          await prisma.message.create({
            data: { conversationId: conversation.id, direction: "outbound", type: "text", content: step.message },
          });
          io.emit("message:new", {
            conversationId: conversation.id,
            content: step.message,
            direction: "outbound",
            timestamp: new Date().toISOString(),
          });
        }
      }
      break;

    case "SILENCE": {
      const silenceUntil = new Date(Date.now() + step.waitSeconds * 1000);
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "silenced", silencedUntil: silenceUntil },
      });
      io.emit("conversation:updated", {
        id: conversation.id,
        status: "silenced",
        silencedUntil: silenceUntil.toISOString(),
      });
      return;
    }

    case "AI_AGENT": {
      const cfg = (step.config as any) || {};
      let configId = cfg.configId;
      if (!configId) {
        const defaultConfig = await prisma.aIConfig.findFirst({ where: { isDefault: true, isActive: true } });
        if (!defaultConfig) break;
        configId = defaultConfig.id;
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { timestamp: "asc" },
        take: 50,
      });

      const aiMessages: { role: string; content: string }[] = [];

      const systemPrompt = bot.systemPrompt || cfg.systemPrompt;
      if (systemPrompt) {
        aiMessages.push({ role: "system", content: systemPrompt });
      }

      for (const msg of messages) {
        aiMessages.push({
          role: msg.direction === "inbound" ? "user" : "assistant",
          content: msg.content,
        });
      }

      const response = await generateResponse(configId, aiMessages, { botId: bot.id });
      if (response) {
        const contact = await prisma.contact.findUnique({ where: { id: conversation.contactId } });
        if (contact) {
          await engine.sendText(contact.phone, response);
          await prisma.message.create({
            data: { conversationId: conversation.id, direction: "outbound", type: "text", content: response },
          });
          io.emit("message:new", {
            conversationId: conversation.id,
            content: response,
            direction: "outbound",
            timestamp: new Date().toISOString(),
          });
        }
      }
      break;
    }

    case "HTTP_REQUEST": {
      const http = step.httpRoutes;
      if (!http) break;
      const replaceVars = (str: string) => str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => contextVars[key] || "");
      const url = replaceVars(http.url);
      const headers: Record<string, string> = {};
      if (http.headers) {
        const raw = http.headers as Record<string, string>;
        for (const key of Object.keys(raw)) {
          headers[key] = replaceVars(String(raw[key]));
        }
      }
      let body: any = undefined;
      if (http.body) {
        body = JSON.parse(JSON.stringify(http.body));
        for (const key of Object.keys(body)) {
          if (typeof body[key] === "string") body[key] = replaceVars(body[key]);
        }
      }
      try {
        const res = await axios({ method: http.method.toLowerCase(), url, headers, data: body, timeout: http.timeout || 10000 });
        if (http.variableMap) {
          const varMap = http.variableMap as Record<string, string>;
          for (const [key, path] of Object.entries(varMap)) {
            contextVars[key] = path.split(".").reduce((obj: any, p: string) => obj?.[p], res.data);
          }
        }
      } catch (error: any) {
        console.error("HTTP_REQUEST error:", error.message);
      }
      break;
    }

    case "INTENT": {
      const routes = step.intentRoutes;
      if (!routes || routes.length === 0) break;
      const aiConfig = await prisma.aIConfig.findFirst({ where: { isDefault: true, isActive: true } });
      if (!aiConfig) break;
      const result = await classifyIntent(aiConfig.id, userMessage, routes.map((r) => ({ label: r.label, samples: r.samples })));
      const matched = routes.find((r) => r.label === result.label);
      if (matched && matched.nextStepId && result.confidence >= 0.3) {
        const idx = bot.flowSteps.findIndex((s) => s.id === matched.nextStepId);
        if (idx !== -1) {
          contextVars.currentStepIndex = idx;
          await prisma.conversation.update({ where: { id: conversation.id }, data: { contextVars } });
          return;
        }
      }
      break;
    }

    case "FORWARD": {
      const cfg = (step.config as any) || {};
      const updateData: any = { status: "waiting_agent", contextVars };
      if (cfg.agentId) updateData.assignedAgentId = cfg.agentId;
      await prisma.conversation.update({ where: { id: conversation.id }, data: updateData });
      io.emit("conversation:updated", { id: conversation.id, status: "waiting_agent", assignedAgentId: cfg.agentId || null });
      return;
    }
  }

  const nextIndex = currentStepIndex + 1;
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      contextVars: { ...contextVars, currentStepIndex: nextIndex },
      currentStepId: bot.flowSteps[nextIndex]?.id || null,
    },
  });
}
