import prisma from "../lib/prisma";

export async function createRule(data: {
  name: string;
  priority?: number;
  condition: any;
  targetAgentId?: string;
  targetTeam?: string;
}) {
  return prisma.routingRule.create({
    data: {
      name: data.name,
      priority: data.priority || 0,
      condition: data.condition,
      targetAgentId: data.targetAgentId,
      targetTeam: data.targetTeam,
    },
  });
}

export async function getRules() {
  return prisma.routingRule.findMany({
    orderBy: { priority: "desc" },
  });
}

export async function updateRule(id: string, data: Partial<{
  name: string;
  priority: number;
  condition: any;
  targetAgentId: string;
  targetTeam: string;
  isActive: boolean;
}>) {
  return prisma.routingRule.update({ where: { id }, data });
}

export async function deleteRule(id: string) {
  return prisma.routingRule.delete({ where: { id } });
}

export async function routeConversation(contactId: string, context: {
  source?: string;
  tags?: string[];
  score?: number;
}): Promise<{ agentId?: string; team?: string } | null> {
  const rules = await prisma.routingRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  for (const rule of rules) {
    const cond = rule.condition as any;
    let matches = true;

    // Check min score
    if (cond.minScore && (!context.score || context.score < cond.minScore)) {
      matches = false;
    }

    // Check required tags
    if (cond.tags && cond.tags.length > 0) {
      const hasAllTags = cond.tags.every((t: string) => context.tags?.includes(t));
      if (!hasAllTags) matches = false;
    }

    // Check source
    if (cond.source && context.source !== cond.source) {
      matches = false;
    }

    if (matches) {
      return {
        agentId: rule.targetAgentId || undefined,
        team: rule.targetTeam || undefined,
      };
    }
  }

  return null;
}

export async function autoAssignAgent(contactId: string, context: {
  source?: string;
  tags?: string[];
  score?: number;
}): Promise<string | null> {
  // Try routing rules first
  const routed = await routeConversation(contactId, context);
  if (routed?.agentId) return routed.agentId;

  // If team specified, find available agent in team
  // (simplified: just find the agent with fewest active conversations)
  const agents = await prisma.user.findMany({
    where: { role: "AGENT", isActive: true },
    include: {
      _count: {
        select: {
          assignedConversations: { where: { status: { in: ["active", "waiting_agent"] } } },
        },
      },
    },
    orderBy: { assignedConversations: { _count: "asc" } },
    take: 1,
  });

  return agents[0]?.id || null;
}

export async function seedRoutingRules() {
  const count = await prisma.routingRule.count();
  if (count > 0) return;

  await prisma.routingRule.createMany({
    data: [
      {
        name: "Leads calientes → Ventas",
        priority: 100,
        condition: { minScore: 80 },
        targetTeam: "ventas",
      },
      {
        name: "Leads de anuncios → Ventas",
        priority: 90,
        condition: { source: "ad" },
        targetTeam: "ventas",
      },
      {
        name: "VIP → Agente senior",
        priority: 80,
        condition: { tags: ["vip"] },
      },
    ],
  });

  console.log("Seed: Routing rules creadas");
}
