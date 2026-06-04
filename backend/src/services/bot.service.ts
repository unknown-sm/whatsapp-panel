import prisma from "../lib/prisma";
import { z } from "zod";

const createBotSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  systemPrompt: z.string().optional(),
  exactMatch: z.boolean().default(false),
  isActive: z.boolean().default(true),
  keywords: z.array(z.string().min(1)).default([]),
});

const updateBotSchema = z.object({
  name: z.string().min(1).optional(),
  systemPrompt: z.string().optional().nullable(),
  exactMatch: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function getAllBots() {
  return prisma.bot.findMany({
    include: { keywords: true, _count: { select: { flowSteps: true, conversations: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBotById(id: string) {
  return prisma.bot.findUnique({
    where: { id },
    include: { keywords: true, flowSteps: { orderBy: { order: "asc" } } },
  });
}

export async function createBot(data: { name: string; systemPrompt?: string; exactMatch?: boolean; isActive?: boolean; keywords?: string[] }) {
  const parsed = createBotSchema.parse(data);
  return prisma.bot.create({
    data: {
      name: parsed.name,
      systemPrompt: parsed.systemPrompt,
      exactMatch: parsed.exactMatch,
      isActive: parsed.isActive,
      keywords: { create: parsed.keywords.map((kw) => ({ keyword: kw })) },
    },
    include: { keywords: true },
  });
}

export async function updateBot(id: string, data: { name?: string; systemPrompt?: string | null; exactMatch?: boolean; isActive?: boolean }) {
  const parsed = updateBotSchema.parse(data);
  return prisma.bot.update({ where: { id }, data: parsed, include: { keywords: true } });
}

export async function deleteBot(id: string) {
  return prisma.bot.delete({ where: { id } });
}

export async function addKeyword(botId: string, keyword: string) {
  return prisma.botKeyword.create({ data: { botId, keyword } });
}

export async function removeKeyword(id: string) {
  return prisma.botKeyword.delete({ where: { id } });
}

export async function setDefault(id: string) {
  await prisma.bot.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  return prisma.bot.update({ where: { id }, data: { isDefault: true }, include: { keywords: true } });
}

export async function findBotByKeyword(text: string) {
  const bots = await prisma.bot.findMany({
    where: { isActive: true },
    include: { keywords: true },
  });

  for (const bot of bots) {
    for (const kw of bot.keywords) {
      if (bot.exactMatch) {
        if (text.toLowerCase() === kw.keyword.toLowerCase()) return bot;
      } else {
        if (text.toLowerCase().includes(kw.keyword.toLowerCase())) return bot;
      }
    }
  }

  return prisma.bot.findFirst({
    where: { isActive: true, isDefault: true },
    include: { keywords: true },
  });
}