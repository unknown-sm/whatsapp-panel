import prisma from "../lib/prisma";

export async function getMessagesOverTime(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const messages = await prisma.message.groupBy({
    by: ["timestamp"],
    where: { timestamp: { gte: startDate } },
    _count: { id: true },
  });

  // Group by date
  const byDate = new Map<string, number>();
  messages.forEach((m) => {
    const date = m.timestamp.toISOString().split("T")[0];
    byDate.set(date, (byDate.get(date) || 0) + m._count.id);
  });

  // Fill missing dates
  const result = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    result.push({ date: dateStr, count: byDate.get(dateStr) || 0 });
  }

  return result;
}

export async function getConversationsByBot() {
  return prisma.conversation.groupBy({
    by: ["botId"],
    _count: { id: true },
    where: { botId: { not: null } },
  });
}

export async function getContactGrowth(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const contacts = await prisma.contact.groupBy({
    by: ["createdAt"],
    where: { createdAt: { gte: startDate } },
    _count: { id: true },
  });

  const byDate = new Map<string, number>();
  contacts.forEach((c) => {
    const date = c.createdAt.toISOString().split("T")[0];
    byDate.set(date, (byDate.get(date) || 0) + c._count.id);
  });

  const result = [];
  let cumulative = 0;
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    cumulative += byDate.get(dateStr) || 0;
    result.push({ date: dateStr, new: byDate.get(dateStr) || 0, total: cumulative });
  }

  return result;
}

export async function getDealFunnel(pipelineId?: string) {
  const where: any = {};
  if (pipelineId) where.pipelineId = pipelineId;

  const stages = await prisma.pipelineStage.findMany({
    where: pipelineId ? { pipelineId } : {},
    include: { _count: { select: { deals: true } } },
    orderBy: { order: "asc" },
  });

  return stages.map((s) => ({
    stage: s.name,
    count: s._count.deals,
    color: s.color,
  }));
}

export async function getTopBots(limit: number = 5) {
  const bots = await prisma.bot.findMany({
    include: {
      _count: {
        select: { conversations: true, keywords: true },
      },
    },
    orderBy: { conversations: { _count: "desc" } },
    take: limit,
  });

  return bots.map((b) => ({
    id: b.id,
    name: b.name,
    conversations: b._count.conversations,
    keywords: b._count.keywords,
    isActive: b.isActive,
  }));
}

export async function getOverviewStats() {
  const [
    totalContacts,
    totalConversations,
    totalMessages,
    totalDeals,
    wonDeals,
    totalValue,
    activeBots,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.deal.count(),
    prisma.deal.count({ where: { status: "WON" } }),
    prisma.deal.aggregate({ _sum: { value: true } }),
    prisma.bot.count({ where: { isActive: true } }),
  ]);

  return {
    totalContacts,
    totalConversations,
    totalMessages,
    totalDeals,
    wonDeals,
    totalValue: totalValue._sum.value || 0,
    activeBots,
    conversionRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0,
  };
}
