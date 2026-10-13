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

export async function getAllBots(orgId: string) {
  return prisma.bot.findMany({
    where: { orgId },
    include: { keywords: true, _count: { select: { flowSteps: true, conversations: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBotById(id: string, orgId: string) {
  return prisma.bot.findFirst({
    where: { id, orgId },
    include: { keywords: true, flowSteps: { orderBy: { order: "asc" } } },
  });
}

export async function createBot(data: { name: string; systemPrompt?: string; exactMatch?: boolean; isActive?: boolean; keywords?: string[]; orgId?: string }) {
  const parsed = createBotSchema.parse(data);
  return prisma.bot.create({
    data: {
      name: parsed.name,
      systemPrompt: parsed.systemPrompt,
      exactMatch: parsed.exactMatch,
      isActive: parsed.isActive,
      orgId: data.orgId || null,
      keywords: { create: parsed.keywords.map((kw) => ({ keyword: kw })) },
    },
    include: { keywords: true },
  });
}

export async function updateBot(id: string, data: { name?: string; systemPrompt?: string | null; exactMatch?: boolean; isActive?: boolean; isDefault?: boolean }, orgId: string) {
  const parsed = updateBotSchema.parse(data);
  const owned = await prisma.bot.findFirst({ where: { id, orgId }, select: { id: true } });
  if (!owned) return null;
  return prisma.bot.update({ where: { id }, data: parsed, include: { keywords: true } });
}

export async function deleteBot(id: string, orgId: string) {
  const result = await prisma.bot.deleteMany({ where: { id, orgId } });
  return result.count > 0;
}

export async function addKeyword(botId: string, keyword: string, orgId: string) {
  const owned = await prisma.bot.findFirst({ where: { id: botId, orgId }, select: { id: true } });
  if (!owned) return null;
  return prisma.botKeyword.create({ data: { botId, keyword } });
}

export async function removeKeyword(id: string, orgId: string) {
  const result = await prisma.botKeyword.deleteMany({ where: { id, bot: { orgId } } });
  return result.count > 0;
}

export async function setDefault(id: string, orgId: string) {
  const owned = await prisma.bot.findFirst({ where: { id, orgId }, select: { id: true } });
  if (!owned) return null;
  await prisma.bot.updateMany({ where: { isDefault: true, orgId }, data: { isDefault: false } });
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

