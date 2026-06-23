import prisma from "../lib/prisma";

// ─── Playbooks CRUD ────────────────────────────────

export async function createPlaybook(data: {
  name: string;
  description?: string;
  methodology: string;
  stages: { order: number; name: string; prompt: string; questionType?: string; options?: string[] }[];
}) {
  return prisma.salesPlaybook.create({
    data: {
      name: data.name,
      description: data.description,
      methodology: data.methodology,
      stages: {
        create: data.stages.map((s) => ({
          order: s.order,
          name: s.name,
          prompt: s.prompt,
          questionType: s.questionType || "open",
          options: s.options || [],
        })),
      },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export async function getPlaybooks() {
  return prisma.salesPlaybook.findMany({
    include: {
      stages: { orderBy: { order: "asc" } },
      _count: { select: { abTests: true, abTestsB: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPlaybook(id: string) {
  return prisma.salesPlaybook.findUnique({
    where: { id },
    include: {
      stages: { orderBy: { order: "asc" } },
      abTests: { where: { status: "running" }, include: { assignments: true } },
    },
  });
}

export async function updatePlaybook(id: string, data: Partial<{ name: string; description: string; methodology: string; isActive: boolean; isDefault: boolean }>) {
  return prisma.salesPlaybook.update({ where: { id }, data });
}

export async function deletePlaybook(id: string) {
  return prisma.salesPlaybook.delete({ where: { id } });
}

export async function setDefaultPlaybook(id: string) {
  await prisma.salesPlaybook.updateMany({ data: { isDefault: false } });
  return prisma.salesPlaybook.update({ where: { id }, data: { isDefault: true } });
}

// ─── Stages CRUD ───────────────────────────────────

export async function updateStage(id: string, data: Partial<{ name: string; prompt: string; questionType: string; options: string[]; order: number }>) {
  return prisma.playbookStage.update({ where: { id }, data });
}

export async function deleteStage(id: string) {
  return prisma.playbookStage.delete({ where: { id } });
}

// ─── A/B Testing ───────────────────────────────────

export async function createABTest(data: {
  playbookAId: string;
  playbookBId: string;
  trafficSplit?: number;
  metric?: string;
}) {
  return prisma.playbookABTest.create({
    data: {
      playbookAId: data.playbookAId,
      playbookBId: data.playbookBId,
      trafficSplit: data.trafficSplit || 50,
      metric: data.metric || "conversion_rate",
      status: "running",
      startedAt: new Date(),
    },
    include: { playbookA: true, playbookB: true },
  });
}

export async function getABTests() {
  return prisma.playbookABTest.findMany({
    include: {
      playbookA: true,
      playbookB: true,
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function assignContactToTest(testId: string, contactId: string): Promise<"A" | "B"> {
  // Check if already assigned
  const existing = await prisma.playbookABTestAssignment.findFirst({
    where: { testId, contactId },
  });
  if (existing) return existing.variant as "A" | "B";

  const test = await prisma.playbookABTest.findUnique({ where: { id: testId } });
  if (!test || test.status !== "running") return "A";

  // Random assignment based on traffic split
  const variant = Math.random() * 100 < test.trafficSplit ? "A" : "B";

  await prisma.playbookABTestAssignment.create({
    data: { testId, contactId, variant },
  });

  return variant;
}

export async function markConversion(testId: string, contactId: string, value?: number) {
  const assignment = await prisma.playbookABTestAssignment.findFirst({
    where: { testId, contactId },
  });
  if (!assignment) return null;

  return prisma.playbookABTestAssignment.update({
    where: { id: assignment.id },
    data: { converted: true, conversionValue: value },
  });
}

export async function getTestResults(testId: string) {
  const test = await prisma.playbookABTest.findUnique({
    where: { id: testId },
    include: {
      playbookA: true,
      playbookB: true,
      assignments: true,
    },
  });
  if (!test) return null;

  const variantA = test.assignments.filter((a) => a.variant === "A");
  const variantB = test.assignments.filter((a) => a.variant === "B");

  const convertedA = variantA.filter((a) => a.converted);
  const convertedB = variantB.filter((a) => a.converted);

  const conversionRateA = variantA.length > 0 ? convertedA.length / variantA.length : 0;
  const conversionRateB = variantB.length > 0 ? convertedB.length / variantB.length : 0;

  const avgValueA = convertedA.length > 0 ? convertedA.reduce((s, a) => s + (a.conversionValue || 0), 0) / convertedA.length : 0;
  const avgValueB = convertedB.length > 0 ? convertedB.reduce((s, a) => s + (a.conversionValue || 0), 0) / convertedB.length : 0;

  // Simple statistical significance (chi-squared approximation)
  const totalA = variantA.length;
  const totalB = variantB.length;
  const pA = totalA > 0 ? convertedA.length / totalA : 0;
  const pB = totalB > 0 ? convertedB.length / totalB : 0;
  const pPool = (totalA + totalB) > 0 ? (convertedA.length + convertedB.length) / (totalA + totalB) : 0;
  const se = pPool > 0 && pPool < 1 ? Math.sqrt(pPool * (1 - pPool) * (1 / Math.max(totalA, 1) + 1 / Math.max(totalB, 1))) : 0;
  const zScore = se > 0 ? Math.abs(pA - pB) / se : 0;
  // Approximate p-value from z-score
  const confidence = zScore > 1.96 ? 0.95 : zScore > 1.645 ? 0.90 : zScore > 1.28 ? 0.80 : 0;

  return {
    test,
    variantA: {
      name: test.playbookA.name,
      total: totalA,
      converted: convertedA.length,
      conversionRate: Math.round(conversionRateA * 10000) / 100,
      avgValue: Math.round(avgValueA * 100) / 100,
      totalValue: convertedA.reduce((s, a) => s + (a.conversionValue || 0), 0),
    },
    variantB: {
      name: test.playbookB.name,
      total: totalB,
      converted: convertedB.length,
      conversionRate: Math.round(conversionRateB * 10000) / 100,
      avgValue: Math.round(avgValueB * 100) / 100,
      totalValue: convertedB.reduce((s, a) => s + (a.conversionValue || 0), 0),
    },
    significance: {
      zScore: Math.round(zScore * 100) / 100,
      confidence: Math.round(confidence * 100),
      winner: conversionRateA > conversionRateB ? "A" : conversionRateB > conversionRateA ? "B" : null,
      isSignificant: confidence >= 0.95,
    },
    status: test.status,
    startedAt: test.startedAt,
  };
}

export async function completeTest(testId: string) {
  const results = await getTestResults(testId);
  if (!results) return null;

  const winnerId = results.significance.winner === "A" ? results.test.playbookAId : results.test.playbookBId;

  return prisma.playbookABTest.update({
    where: { id: testId },
    data: {
      status: "completed",
      endedAt: new Date(),
      winnerId,
      confidence: results.significance.confidence,
      resultsA: results.variantA as any,
      resultsB: results.variantB as any,
    },
  });
}

// ─── Playbook Selection Logic ──────────────────────

export async function selectPlaybookForContact(contactId: string, source?: string): Promise<string | null> {
  // Check if there's a running A/B test
  const runningTest = await prisma.playbookABTest.findFirst({
    where: { status: "running" },
    include: { playbookA: true, playbookB: true },
  });

  if (runningTest) {
    const variant = await assignContactToTest(runningTest.id, contactId);
    return variant === "A" ? runningTest.playbookAId : runningTest.playbookBId;
  }

  // Select based on source
  if (source === "ad" || source === "facebook" || source === "instagram") {
    // For ad traffic, prefer AIDA (quick conversion)
    const aida = await prisma.salesPlaybook.findFirst({
      where: { methodology: "AIDA", isActive: true },
    });
    if (aida) return aida.id;
  }

  // Default playbook
  const defaultPlaybook = await prisma.salesPlaybook.findFirst({
    where: { isDefault: true, isActive: true },
  });
  if (defaultPlaybook) return defaultPlaybook.id;

  // Any active playbook
  const anyPlaybook = await prisma.salesPlaybook.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return anyPlaybook?.id || null;
}

// ─── Seed Default Playbooks ────────────────────────

export async function seedPlaybooks() {
  const existing = await prisma.salesPlaybook.count();
  if (existing > 0) return;

  const playbooks = [
    {
      name: "AIDA - Conversion Rapida",
      description: "Funnel rapido para leads de anuncios. Atencion → Interes → Deseo → Accion.",
      methodology: "AIDA",
      isDefault: true,
      stages: [
        { order: 1, name: "Atencion", prompt: "¡Hola {nombre}! 👋 Vi que te interesa {producto}. ¿Tienes 2 minutos para contarte algo que te va a interesar?", questionType: "open" },
        { order: 2, name: "Interes", prompt: "📊 Nuestros clientes han logrado +40% mas ventas capturando leads 24/7. ¿Actualmente cuanto tardas en responder a tus clientes?", questionType: "multiple_choice", options: ["Menos de 5 min", "5-30 min", "30 min - 1 hora", "Mas de 1 hora"] },
        { order: 3, name: "Deseo", prompt: "{nombre} de {empresa} estaba en tu misma situacion. Hoy captura el 95% de leads automaticamente. ¿Quieres ver como lo hizo?", questionType: "multiple_choice", options: ["Si, quiero ver", "Cuentame mas", "No me interesa"] },
        { order: 4, name: "Accion", prompt: "Perfecto. Te propongo una demo personalizada de 15 minutos. ¿Mañana a las 10am o jueves a las 3pm?", questionType: "multiple_choice", options: ["Mañana 10am", "Jueves 3pm", "Otro horario"] },
      ],
    },
    {
      name: "BANT - Calificacion de Leads",
      description: "Calificacion rapida: Presupuesto, Autoridad, Necesidad, Timeline.",
      methodology: "BANT",
      isDefault: false,
      stages: [
        { order: 1, name: "Presupuesto", prompt: "Para recomendarte la mejor opcion, ¿has definido una inversion aproximada?\n\n💰 A) Menos de $500/mes\n💰 B) $500 - $1,500/mes\n💰 C) Mas de $1,500/mes\n💰 D) Aun no lo se", questionType: "multiple_choice", options: ["Menos de $500/mes", "$500 - $1,500/mes", "Mas de $1,500/mes", "Aun no lo se"] },
        { order: 2, name: "Autoridad", prompt: "¿Tu tomas esta decision o hay alguien mas involucrado?\n\n1️⃣ Yo decido solo/a\n2️⃃ Consulto con alguien mas\n3️⃣ Es un equipo de decision", questionType: "multiple_choice", options: ["Yo decido solo/a", "Consulto con alguien mas", "Es un equipo de decision"] },
        { order: 3, name: "Necesidad", prompt: "¿Que problema especifico necesitas resolver?\n\nA) Automatizar respuestas frecuentes\nB) Mejorar seguimiento de leads\nC) Generar mas ventas desde WhatsApp\nD) Otro", questionType: "multiple_choice", options: ["Automatizar respuestas", "Mejorar seguimiento", "Generar mas ventas", "Otro"] },
        { order: 4, name: "Timeline", prompt: "¿Cuando necesitas tener esto funcionando?\n\n⏰ Lo antes posible / Este mes / Solo explorando", questionType: "multiple_choice", options: ["Lo antes posible", "Este mes", "Solo explorando"] },
      ],
    },
    {
      name: "SPIN - Venta Consultiva",
      description: "Situacion → Problema → Implicacion → Necesidad. Para productos complejos.",
      methodology: "SPIN",
      isDefault: false,
      stages: [
        { order: 1, name: "Situacion", prompt: "¡Hola! Para ayudarte mejor, cuéntame sobre tu negocio:\n\n1️⃣ ¿Que tipo de productos/servicios ofreces?\n2️⃣ ¿Cuantos clientes manejas actualmente?\n3️⃣ ¿Que herramientas usas para comunicarte con ellos?", questionType: "open" },
        { order: 2, name: "Problema", prompt: "¿Y cual dirias que es tu mayor reto hoy?\n\nA) Pierdo tiempo respondiendo mensajes manualmente\nB) No logro dar seguimiento a todos los leads\nC) Me cuesta medir que funciona y que no\nD) Otro", questionType: "multiple_choice", options: ["Pierdo tiempo respondiendo", "No doy seguimiento", "No se que funciona", "Otro"] },
        { order: 3, name: "Implicacion", prompt: "Si no resuelves ese problema, ¿cuantos leads calculas que se te escapan al mes? Eso podria significar ventas perdidas significativas.", questionType: "open" },
        { order: 4, name: "Necesidad", prompt: "Si pudieras resolver esto, ¿que significaria para tu negocio? Imagina que cada lead recibe respuesta en menos de 2 minutos, 24/7.", questionType: "open" },
      ],
    },
  ];

  for (const pb of playbooks) {
    await createPlaybook(pb);
  }

  console.log(`Seed: ${playbooks.length} playbooks creados`);
}
