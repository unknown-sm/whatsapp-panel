import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Rules ─────────────────────────────────────────

export async function createRule(data: {
  name: string;
  condition: string;
  config?: any;
  points: number;
}) {
  return prisma.leadScoreRule.create({
    data: {
      name: data.name,
      condition: data.condition as any,
      config: data.config || {},
      points: data.points,
    },
  });
}

export async function getRules() {
  return prisma.leadScoreRule.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scores: true } } },
  });
}

export async function updateRule(id: string, data: Partial<{ name: string; condition: string; config: any; points: number; isActive: boolean }>) {
  const updateData: any = { ...data };
  if (data.condition) updateData.condition = data.condition;
  return prisma.leadScoreRule.update({ where: { id }, data: updateData });
}

export async function deleteRule(id: string) {
  return prisma.leadScoreRule.delete({ where: { id } });
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

export async function getContactScores(contactId: string) {
  return prisma.leadScore.findMany({
    where: { contactId },
    include: { rule: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLeaderboard(limit: number = 50) {
  const scores = await prisma.leadScore.groupBy({
    by: ["contactId"],
    _sum: { points: true },
    _count: { id: true },
    orderBy: { _sum: { points: "desc" } },
    take: limit,
  });

  const contactIds = scores.map((s) => s.contactId);
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds } },
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

export async function recalculateScores() {
  // Delete all existing scores
  await prisma.leadScore.deleteMany({});

  // Get all active rules
  const rules = await prisma.leadScoreRule.findMany({ where: { isActive: true } });

  const scoresToCreate: any[] = [];

  for (const rule of rules) {
    switch (rule.condition) {
      case "MESSAGE_RECEIVED": {
        const conversations = await prisma.conversation.findMany({
          include: { messages: true, contact: true },
        });
        for (const conv of conversations) {
          const inboundCount = conv.messages.filter((m) => m.direction === "inbound").length;
          if (inboundCount > 0) {
            scoresToCreate.push({
              contactId: conv.contactId,
              ruleId: rule.id,
              points: rule.points * inboundCount,
              reason: `${inboundCount} mensajes recibidos`,
            });
          }
        }
        break;
      }
      case "MESSAGE_SENT": {
        const conversations = await prisma.conversation.findMany({
          include: { messages: true },
        });
        for (const conv of conversations) {
          const outboundCount = conv.messages.filter((m) => m.direction === "outbound").length;
          if (outboundCount > 0) {
            scoresToCreate.push({
              contactId: conv.contactId,
              ruleId: rule.id,
              points: rule.points * outboundCount,
              reason: `${outboundCount} mensajes enviados`,
            });
          }
        }
        break;
      }
      case "CONVERSATION_CLOSED": {
        const closed = await prisma.conversation.findMany({
          where: { status: "closed" },
        });
        for (const conv of closed) {
          scoresToCreate.push({
            contactId: conv.contactId,
            ruleId: rule.id,
            points: rule.points,
            reason: "Conversacion cerrada",
          });
        }
        break;
      }
      case "FOLLOW_UP_REPLIED": {
        const attempts = await prisma.followUpAttempt.findMany({
          where: { replied: true },
          include: { conversation: true },
        });
        for (const attempt of attempts) {
          scoresToCreate.push({
            contactId: attempt.conversation.contactId,
            ruleId: rule.id,
            points: rule.points,
            reason: "Respondio seguimiento",
          });
        }
        break;
      }
      case "DEAL_WON": {
        const deals = await prisma.deal.findMany({
          where: { status: "WON" },
        });
        for (const deal of deals) {
          if (deal.contactId) {
            scoresToCreate.push({
              contactId: deal.contactId,
              ruleId: rule.id,
              points: rule.points,
              reason: `Deal ganado: ${deal.name}`,
            });
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
