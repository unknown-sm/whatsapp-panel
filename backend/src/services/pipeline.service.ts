import prisma from "../lib/prisma";

export async function createPipeline(data: { name: string; description?: string }, orgId?: string) {
  return prisma.pipeline.create({
    data: { name: data.name, description: data.description, orgId: orgId || null },
    include: { stages: true, deals: true },
  });
}

export async function getPipelines(orgId?: string) {
  return prisma.pipeline.findMany({
    where: orgId ? { orgId } : undefined,
    include: {
      stages: { orderBy: { order: "asc" } },
      _count: { select: { deals: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPipelineById(id: string, orgId?: string) {
  return prisma.pipeline.findFirst({
    where: { id, ...(orgId ? { orgId } : {}) },
    include: {
      stages: { orderBy: { order: "asc" } },
      deals: {
        include: { contact: true, assignedTo: { select: { id: true, name: true, email: true } } },
      },
    },
  });
}

export async function updatePipeline(id: string, data: Partial<{ name: string; description: string; isDefault: boolean }>) {
  if (data.isDefault) {
    await prisma.pipeline.updateMany({ where: {}, data: { isDefault: false } });
  }
  return prisma.pipeline.update({
    where: { id },
    data,
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export async function deletePipeline(id: string) {
  return prisma.pipeline.delete({ where: { id } });
}

// ─── Stages ────────────────────────────────────────

export async function createStage(data: { name: string; pipelineId: string; order?: number; color?: string }) {
  const order = data.order ?? (await prisma.pipelineStage.count({ where: { pipelineId: data.pipelineId } }));
  return prisma.pipelineStage.create({
    data: { name: data.name, pipelineId: data.pipelineId, order, color: data.color || "#3B82F6" },
    include: { pipeline: true },
  });
}

export async function updateStage(id: string, data: Partial<{ name: string; order: number; color: string }>) {
  return prisma.pipelineStage.update({ where: { id }, data });
}

export async function deleteStage(id: string) {
  return prisma.pipelineStage.delete({ where: { id } });
}

// ─── Deals ─────────────────────────────────────────

export async function createDeal(data: {
  name: string;
  value?: number;
  currency?: string;
  contactId?: string;
  stageId: string;
  pipelineId: string;
  priority?: string;
  assignedToId?: string;
  expectedCloseDate?: string;
  source?: string;
  tags?: string[];
  notes?: string;
  orgId?: string;
}) {
  return prisma.deal.create({
    data: {
      name: data.name,
      value: data.value || 0,
      currency: data.currency || "USD",
      contactId: data.contactId || null,
      stageId: data.stageId,
      pipelineId: data.pipelineId,
      priority: (data.priority as any) || "MEDIUM",
      assignedToId: data.assignedToId || null,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
      source: data.source || null,
      tags: data.tags || [],
      notes: data.notes || null,
      orgId: data.orgId || null,
    },
    include: {
      contact: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      stage: true,
      pipeline: true,
    },
  });
}

export async function getDeals(filters?: { pipelineId?: string; stageId?: string; status?: string; assignedToId?: string }, orgId?: string) {
  const where: any = {};
  if (orgId) where.orgId = orgId;
  if (filters?.pipelineId) where.pipelineId = filters.pipelineId;
  if (filters?.stageId) where.stageId = filters.stageId;
  if (filters?.status) where.status = filters.status;
  if (filters?.assignedToId) where.assignedToId = filters.assignedToId;

  return prisma.deal.findMany({
    where,
    include: {
      contact: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      stage: true,
      pipeline: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDealById(id: string, orgId?: string) {
  return prisma.deal.findFirst({
    where: { id, ...(orgId ? { orgId } : {}) },
    include: {
      contact: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      stage: true,
      pipeline: true,
    },
  });
}

export async function updateDeal(id: string, data: Partial<{
  name: string; value: number; currency: string; contactId: string;
  stageId: string; pipelineId: string; status: string; priority: string;
  assignedToId: string; expectedCloseDate: string; source: string;
  tags: string[]; notes: string;
}>) {
  const updateData: any = { ...data };
  if (data.expectedCloseDate) updateData.expectedCloseDate = new Date(data.expectedCloseDate);
  return prisma.deal.update({
    where: { id },
    data: updateData,
    include: {
      contact: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      stage: true,
      pipeline: true,
    },
  });
}

export async function moveDeal(dealId: string, stageId: string) {
  return prisma.deal.update({
    where: { id: dealId },
    data: { stageId },
    include: {
      contact: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      stage: true,
    },
  });
}

export async function deleteDeal(id: string) {
  return prisma.deal.delete({ where: { id } });
}

// ─── Stats ─────────────────────────────────────────

export async function getRevenueSummary() {
  const [totalValue, totalDeals, wonValue, wonDeals, openValue, openDeals, avgDealValue] = await Promise.all([
    prisma.deal.aggregate({ _sum: { value: true } }),
    prisma.deal.count(),
    prisma.deal.aggregate({ where: { status: "WON" }, _sum: { value: true } }),
    prisma.deal.count({ where: { status: "WON" } }),
    prisma.deal.aggregate({ where: { status: "OPEN" }, _sum: { value: true } }),
    prisma.deal.count({ where: { status: "OPEN" } }),
    prisma.deal.aggregate({ _avg: { value: true } }),
  ]);

  return {
    totalValue: totalValue._sum.value || 0,
    totalDeals,
    wonValue: wonValue._sum.value || 0,
    wonDeals,
    openValue: openValue._sum.value || 0,
    openDeals,
    avgDealValue: avgDealValue._avg.value || 0,
    conversionRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0,
  };
}

export async function getPipelineStats(pipelineId: string) {
  const [totalValue, totalDeals, wonValue, wonDeals, stages] = await Promise.all([
    prisma.deal.aggregate({ where: { pipelineId }, _sum: { value: true } }),
    prisma.deal.count({ where: { pipelineId } }),
    prisma.deal.aggregate({ where: { pipelineId, status: "WON" }, _sum: { value: true } }),
    prisma.deal.count({ where: { pipelineId, status: "WON" } }),
    prisma.pipelineStage.findMany({
      where: { pipelineId },
      include: { _count: { select: { deals: true } } },
      orderBy: { order: "asc" },
    }),
  ]);

  return {
    totalValue: totalValue._sum.value || 0,
    totalDeals,
    wonValue: wonValue._sum.value || 0,
    wonDeals,
    conversionRate: totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0,
    stages: stages.map((s) => ({ id: s.id, name: s.name, count: s._count.deals })),
  };
}
