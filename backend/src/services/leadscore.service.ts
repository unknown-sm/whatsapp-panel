import prisma from "../lib/prisma";

// ─── Rules ─────────────────────────────────────────

export async function createRule(data: {
  name: string;
  condition: string;
  config?: any;
  points: number;
  orgId: string;
}) {
  return prisma.leadScoreRule.create({
    data: {
      name: data.name,
      condition: data.condition as any,
      config: data.config || {},
      points: data.points,
      orgId: data.orgId,
    },
  });
}

export async function getRules(orgId: string) {
  return prisma.leadScoreRule.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scores: true } } },
  });
}

export async function updateRule(orgId: string, id: string, data: Partial<{ name: string; condition: string; config: any; points: number; isActive: boolean }>) {
  const updateData: any = { ...data };
  if (data.condition) updateData.condition = data.condition;
  return prisma.leadScoreRule.update({ where: { id, orgId }, data: updateData });
}

export async function deleteRule(orgId: string, id: string) {
  return prisma.leadScoreRule.delete({ where: { id, orgId } });
}

// ─── Scores ────────────────────────────────────────

export async function addScore(data: {
  contactId: string;
  ruleId: string;
  points: number;
  reason: string;
}) {
  return prisma.leadScore.create({
    data: {
      contactId: data.contactId,
      ruleId: data.ruleId,
      points: data.points,
      reason: data.reason,
    },
    include: { contact: true, rule: true },
  });
}

export async function addScoreByCondition(orgId: string, contactId: string, condition: string, reason: string) {
  const rule = await prisma.leadScoreRule.findFirst({
    where: { orgId, condition: condition as any, isActive: true },
  });
  if (!rule) return null;
  const result = await addScore({ contactId, ruleId: rule.id, points: rule.points, reason });

  try {
    const totalScore = await prisma.leadScore.aggregate({
      where: { contactId },
      _sum: { points: true },
    });
    const score = totalScore._sum.points || 0;

    const deal = await prisma.deal.findFirst({
      where: { contactId, orgId, status: "OPEN" },
      include: { stage: true },
      orderBy: { createdAt: "desc" },
    });
    if (!deal) return result;

    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId: deal.pipelineId },
      orderBy: { order: "asc" },
    });

    const currentIdx = stages.findIndex((s) => s.id === deal.stageId);
    if (currentIdx < 0 || currentIdx >= stages.length - 1) return result;

    const currentStage = stages[currentIdx];
    if (currentStage.name.toLowerCase().includes("cerrado")) return result;

    let shouldAdvance = false;
    if (currentIdx <= 1 && score > 30) shouldAdvance = true;
    if (currentIdx <= 2 && score > 60) shouldAdvance = true;

    if (shouldAdvance) {
      const nextStage = stages[currentIdx + 1];
      if (!nextStage.name.toLowerCase().includes("cerrado")) {
        await prisma.deal.update({
          where: { id: deal.id },
          data: { stageId: nextStage.id },
        });
        console.log(`Pipeline auto-advance: deal ${deal.id} → ${nextStage.name} (score: ${score})`);
      }
    }
  } catch {}

  return result;
}

export async function getContactScores(contactId: string, orgId: string) {
  const contact = await prisma.contact.findFirst({ where: { id: contactId, orgId }, select: { orgId: true } });
  if (!contact) return [];
  return prisma.leadScore.findMany({
    where: { contactId },
    include: { rule: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLeaderboard(orgId: string, limit: number = 50) {
  const scores = await prisma.leadScore.groupBy({
    by: ["contactId"],
    where: { contact: { orgId } },
    _sum: { points: true },
    _count: { id: true },
    orderBy: { _sum: { points: "desc" } },
    take: limit,
  });

  const contactIds = scores.map((s) => s.contactId);
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, orgId },
    select: { id: true, name: true, phone: true },
  });

  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return scores.map((s) => ({
    contactId: s.contactId,
    totalPoints: s._sum.points || 0,
    activityCount: s._count.id,
    contact: contactMap.get(s.contactId),
  }));
}

export async function recalculateScores(orgId: string) {
  await prisma.leadScore.deleteMany({ where: { contact: { orgId } } });
  const rules = await prisma.leadScoreRule.findMany({ where: { isActive: true, orgId } });
  const scoresToCreate: any[] = [];

  for (const rule of rules) {
    switch (rule.condition) {
      case "MESSAGE_RECEIVED": {
        const conversations = await prisma.conversation.findMany({
          where: { orgId },
          include: { messages: true },
        });
        for (const conv of conversations) {
          const inboundCount = conv.messages.filter((m) => m.direction === "inbound").length;
          if (inboundCount > 0) {
            scoresToCreate.push({ contactId: conv.contactId, ruleId: rule.id, points: rule.points * inboundCount, reason: `${inboundCount} mensajes recibidos` });
          }
        }
        break;
      }
      case "MESSAGE_SENT": {
        const conversations = await prisma.conversation.findMany({
          where: { orgId },
          include: { messages: true },
        });
        for (const conv of conversations) {
          const outboundCount = conv.messages.filter((m) => m.direction === "outbound").length;
          if (outboundCount > 0) {
            scoresToCreate.push({ contactId: conv.contactId, ruleId: rule.id, points: rule.points * outboundCount, reason: `${outboundCount} mensajes enviados` });
          }
        }
        break;
      }
      case "CONVERSATION_CLOSED": {
        const closed = await prisma.conversation.findMany({ where: { status: "closed", orgId } });
        for (const conv of closed) {
          scoresToCreate.push({ contactId: conv.contactId, ruleId: rule.id, points: rule.points, reason: "Conversacion cerrada" });
        }
        break;
      }
      case "FOLLOW_UP_REPLIED": {
        const attempts = await prisma.followUpAttempt.findMany({
          where: { replied: true, conversation: { orgId } },
          include: { conversation: true },
        });
        for (const attempt of attempts) {
          scoresToCreate.push({ contactId: attempt.conversation.contactId, ruleId: rule.id, points: rule.points, reason: "Respondio seguimiento" });
        }
        break;
      }
      case "DEAL_WON": {
        const deals = await prisma.deal.findMany({ where: { status: "WON", orgId } });
        for (const deal of deals) {
          if (deal.contactId) {
            scoresToCreate.push({ contactId: deal.contactId, ruleId: rule.id, points: rule.points, reason: `Deal ganado: ${deal.name}` });
          }
        }
        break;
      }
    }
  }

  if (scoresToCreate.length > 0) {
    await prisma.leadScore.createMany({ data: scoresToCreate });
  }

  return scoresToCreate.length;
}
