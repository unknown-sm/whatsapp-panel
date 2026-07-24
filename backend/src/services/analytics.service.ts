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

export async function getOverviewStats(orgId?: string) {
  const whereOrg = orgId ? { orgId } : {};
  const [
    totalContacts,
    totalConversations,
    totalMessages,
    totalDeals,
    wonDeals,
    totalValue,
    activeBots,
  ] = await Promise.all([
    prisma.contact.count({ where: whereOrg }),
    prisma.conversation.count({ where: whereOrg }),
    prisma.message.count(),
    prisma.deal.count({ where: whereOrg }),
    prisma.deal.count({ where: { ...whereOrg, status: "WON" } }),
    prisma.deal.aggregate({ _sum: { value: true }, where: whereOrg }),
    prisma.bot.count({ where: { isActive: true, ...whereOrg } }),
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

/* Revenue by ad source */
export async function getRevenueBySource(days: number = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const attributions = await prisma.adAttribution.findMany({
    where: { conversionAt: { gte: startDate } },
  });

  const bySource: Record<string, { leads: number; conversions: number; revenue: number }> = {};
  for (const a of attributions) {
    const src = a.source || "organic";
    if (!bySource[src]) bySource[src] = { leads: 0, conversions: 0, revenue: 0 };
    bySource[src].leads++;
    if (a.conversionAt) {
      bySource[src].conversions++;
      bySource[src].revenue += a.conversionValue || 0;
    }
  }

  return Object.entries(bySource).map(([source, data]) => ({
    source,
    leads: data.leads,
    conversions: data.conversions,
    revenue: Math.round(data.revenue * 100) / 100,
    roas: data.leads > 0 ? Math.round(data.revenue / data.leads) : 0,
  }));
}

/* Agent performance */
export async function getAgentPerformance(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const agents = await prisma.user.findMany({
    where: { role: "AGENT", isActive: true },
    select: { id: true, name: true, email: true },
  });

  const results = [];
  for (const agent of agents) {
    const [assignedDeals, wonDeals, totalResponses] = await Promise.all([
      prisma.deal.count({ where: { assignedToId: agent.id } }),
      prisma.deal.count({ where: { assignedToId: agent.id, status: "WON" } }),
      prisma.message.count({
        where: {
          direction: "outbound",
          timestamp: { gte: startDate },
          conversation: { assignedAgentId: agent.id },
        },
      }),
    ]);

    results.push({
      id: agent.id,
      name: agent.name || agent.email,
      assignedDeals,
      wonDeals,
      totalResponses,
      conversionRate: assignedDeals > 0 ? Math.round((wonDeals / assignedDeals) * 100) : 0,
    });
  }

  return results.sort((a, b) => b.wonDeals - a.wonDeals);
}

/* Simple revenue forecast (linear projection) */
export async function getForecast(months: number = 3) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  // Get monthly revenue for past months
  const deals = await prisma.deal.findMany({
    where: { status: "WON", updatedAt: { gte: startDate } },
    select: { value: true, updatedAt: true },
  });

  const byMonth: Record<string, number> = {};
  for (const d of deals) {
    const key = d.updatedAt.toISOString().slice(0, 7); // YYYY-MM
    byMonth[key] = (byMonth[key] || 0) + (d.value || 0);
  }

  const monthsList = Object.entries(byMonth).sort();
  if (monthsList.length < 2) return { forecast: 0, past: monthsList, trend: "stable" };

  // Simple linear regression
  const n = monthsList.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const y = monthsList[i][1];
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const nextMonthRevenue = Math.max(0, Math.round(slope * n + (sumY - slope * sumX) / n));

  return {
    forecast: nextMonthRevenue,
    trend: slope > 500 ? "up" : slope < -500 ? "down" : "stable",
    past: monthsList.map(([month, revenue]) => ({ month, revenue: Math.round(revenue) })),
    nextMonth: nextMonthRevenue,
  };
}
