import axios from "axios";
import prisma from "../lib/prisma";
import { io } from "../index";

export async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  const config = await prisma.whatsappConfig.findFirst();
  if (!config) {
    console.error("WhatsApp config not found");
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
    await axios.post(url, {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: { body: message },
    }, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return true;
  } catch (error: any) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    return false;
  }
}

export async function sendWhatsAppMedia(phoneNumber: string, mediaId: string, type: "image" | "video" | "document"): Promise<boolean> {
  const config = await prisma.whatsappConfig.findFirst();
  if (!config) return false;

  try {
    const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;
    await axios.post(url, {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type,
      [type]: { id: mediaId },
    }, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return true;
  } catch {
    return false;
  }
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

      let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, status: "active" },
        orderBy: { updatedAt: "desc" },
      });

      if (!conversation) {
        const bots = await prisma.bot.findMany({ where: { isActive: true }, include: { keywords: true } });
        let matchedBot = null;
        for (const bot of bots) {
          for (const kw of bot.keywords) {
            if (bot.exactMatch) {
              if (text.toLowerCase() === kw.keyword.toLowerCase()) { matchedBot = bot; break; }
            } else {
              if (text.toLowerCase().includes(kw.keyword.toLowerCase())) { matchedBot = bot; break; }
            }
          }
          if (matchedBot) break;
        }

        conversation = await prisma.conversation.create({
          data: { contactId: contact.id, botId: matchedBot?.id || null, status: matchedBot ? "active" : "waiting_agent" },
        });
      }

      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "inbound", type: "text", content: text },
      });

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
    include: { flowSteps: { orderBy: { order: "asc" } } },
  });

  if (!bot || bot.flowSteps.length === 0) return;

  const contextVars = (conversation.contextVars as any) || {};
  const currentStepIndex = contextVars.currentStepIndex || 0;

  if (currentStepIndex >= bot.flowSteps.length) return;

  const step = bot.flowSteps[currentStepIndex];

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

    case "AI_AGENT":
      // TODO: Call AI service
      break;

    case "HTTP_REQUEST":
      // TODO: Call HTTP endpoint
      break;
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
