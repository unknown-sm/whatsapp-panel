import prisma from "../lib/prisma";

/* ── Aggregate data for a period ─────────────────────── */

export async function generateReport(period: "daily" | "weekly" | "monthly" = "daily"): Promise<{ data: any; periodStart: Date; periodEnd: Date }> {
  const now = new Date();
  let periodStart: Date;

  if (period === "daily") {
    periodStart = new Date(now);
    periodStart.setHours(0, 0, 0, 0);
  } else if (period === "weekly") {
    periodStart = new Date(now);
    periodStart.setDate(now.getDate() - 7);
    periodStart.setHours(0, 0, 0, 0);
  } else {
    periodStart = new Date(now);
    periodStart.setMonth(now.getMonth() - 1);
    periodStart.setHours(0, 0, 0, 0);
  }

  const periodEnd = now;

  // Aggregate metrics
  const [
    newConversations,
    newContacts,
    inboundMessages,
    outboundMessages,
    newDeals,
    wonDeals,
    totalRevenue,
    newFollowUps,
    leadScoreAgg,
  ] = await Promise.all([
    prisma.conversation.count({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.contact.count({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.message.count({ where: { direction: "inbound", timestamp: { gte: periodStart, lte: periodEnd } } }),
    prisma.message.count({ where: { direction: "outbound", timestamp: { gte: periodStart, lte: periodEnd } } }),
    prisma.deal.count({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.deal.count({ where: { status: "WON", updatedAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.deal.aggregate({
      _sum: { value: true },
      where: { status: "WON", updatedAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.followUpAttempt.count({ where: { sentAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.leadScore.aggregate({ _sum: { points: true }, where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
  ]);

  // Top performing bots
  const topBots = await prisma.conversation.groupBy({
    by: ["botId"],
    _count: { id: true },
    where: { createdAt: { gte: periodStart, lte: periodEnd }, botId: { not: null } },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const data = {
    period,
    summary: {
      newConversations,
      newContacts,
      totalMessages: inboundMessages + outboundMessages,
      inboundMessages,
      outboundMessages,
      newDeals,
      wonDeals,
      revenue: totalRevenue._sum.value || 0,
      newFollowUps,
      leadPoints: leadScoreAgg._sum.points || 0,
      conversionRate: newDeals > 0 ? Math.round((wonDeals / newDeals) * 10000) / 100 : 0,
    },
    topBots: topBots.map((b) => ({ botId: b.botId, count: b._count.id })),
  };

  return { data, periodStart, periodEnd };
}

export async function saveReport(period: "daily" | "weekly" | "monthly" = "daily") {
  const { data, periodStart, periodEnd } = await generateReport(period);
  return prisma.report.create({
    data: {
      period,
      periodStart,
      periodEnd,
      data: data as any,
    },
  });
}

export async function getRecentReports(limit: number = 30) {
  return prisma.report.findMany({
    orderBy: { generatedAt: "desc" },
    take: limit,
  });
}

export async function getReport(id: string) {
  return prisma.report.findUnique({ where: { id } });
}

/* ── Format report as plain text for email ──────────── */

export function formatReportText(data: any, periodStart: Date, periodEnd: Date): string {
  const s = data.summary;
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return [
    `Reporte ${data.period.toUpperCase()}`,
    `Periodo: ${fmt(periodStart)} → ${fmt(periodEnd)}`,
    ``,
    `RESUMEN:`,
    `  Nuevas conversaciones: ${s.newConversations}`,
    `  Nuevos contactos: ${s.newContacts}`,
    `  Mensajes totales: ${s.totalMessages} (${s.inboundMessages} recibidos / ${s.outboundMessages} enviados)`,
    `  Deals nuevos: ${s.newDeals}`,
    `  Deals ganados: ${s.wonDeals}`,
    `  Revenue: $${s.revenue.toLocaleString()}`,
    `  Conversion: ${s.conversionRate}%`,
    `  Follow-ups enviados: ${s.newFollowUps}`,
    `  Lead points sumados: ${s.leadPoints}`,
    ``,
    data.topBots.length > 0
      ? `TOP BOTS:\n${data.topBots.map((b: any, i: number) => `  ${i + 1}. Bot ${b.botId?.slice(0, 8)} - ${b.count} conversaciones`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");
}
