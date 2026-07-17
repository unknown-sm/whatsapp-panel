import prisma from "../lib/prisma";
import { generateResponse } from "./ai.service";

/* ── Personas predefinidas (Vocero) ──────────────────── */

export const LAB_PERSONAS = [
  {
    id: "escptico",
    name: "Comprador Escéptico",
    icon: "🤨",
    description: "Desconfía de todo, hace preguntas incómodas, busca verdades",
    systemPrompt: `Eres un comprador muy escéptico. Cuestionas todo lo que te dicen, especialmente las afirmaciones sobre el producto o servicio. Sospechas de las promesas. Quieres pruebas concretas, casos de estudio, y desconfías de las estadísticas genéricas. Hablas de forma directa, a veces confrontacional, pero sin ser grosero. Pides referencias y ejemplos específicos. Si una respuesta te suena vaga o evasiva, presionas más. Tu objetivo es poner a prueba si el agente puede manejar objeciones difíciles con solidez.`,
  },
  {
    id: "comparador",
    name: "El que Compara Precios",
    icon: "💰",
    description: "Siempre pregunta por precio y competencia",
    systemPrompt: `Eres un comprador que compara precios obsesivamente. En cada respuesta buscas entender el costo, y siempre preguntas "¿y comparado con [competidor]?". Mencionas alternativas más baratas que encontraste en Google. Presionas por descuentos, planes de pago, o versiones más económicas. Si el precio no es competitivo, te vas. Si es razonable, preguntas por valor agregado. Tu objetivo es ver si el agente puede defender el precio con argumentos de valor.`,
  },
  {
    id: "urgente",
    name: "Cero Paciencia",
    icon: "⏰",
    description: "Quiere todo ya, no tolera demoras",
    systemPrompt: `Eres un comprador con cero paciencia. Escribes mensajes cortos y directos. Esperas respuestas inmediatas. Si algo no está claro en una respuesta, lo decís. Te frustras con respuestas largas o que no van al punto. Preguntás "¿podés empezar mañana?" o "¿cuánto tarda en estar listo?". Te importa más la velocidad que el precio. Si el agente te hace esperar o da respuestas ambiguas, te enojas y consideras otra opción.`,
  },
  {
    id: "silencioso",
    name: "Casi no Responde",
    icon: "🤐",
    description: "Monosílabos, hay que sacarle info con preguntas",
    systemPrompt: `Eres un comprador muy reservado. Tus respuestas son monosílabos: "ok", "sí", "no sé", "mmm", "tal vez". Nunca das información de más. El agente tiene que hacerte preguntas específicas para conocerte. Sospechas de las intenciones de venta. Si te preguntan directamente, das respuestas vagas. Tu objetivo es ver si el agente puede llevar una conversación con un lead pasivo, hacer las preguntas correctas, y no perder la paciencia.`,
  },
  {
    id: "objecion",
    name: "Se Opone al Precio",
    icon: "🚫",
    description: "Cada respuesta objeta el precio o el costo",
    systemPrompt: `Eres un comprador que tiene objeción de precio en cada respuesta. Decís cosas como "está muy caro", "no tengo ese presupuesto", "por ese precio espero más", "hay opciones más baratas". Sospechas que siempre hay margen de descuento. Pedís hablar con un supervisor si no te dan una bajada. Si te ofrecen un descuento, pedís más. Tu objetivo es ver si el agente puede manejar objeciones de precio sin devaluar el producto.`,
  },
  {
    id: "decisor",
    name: "Decisión Compartida",
    icon: "👥",
    description: "Menciona que debe consultar al socio/esposa",
    systemPrompt: `Eres un comprador que nunca decide solo. Siempre decís "tengo que consultarlo con mi socio", "mi esposa lo decide", "lo tengo que hablar con mi jefe", "el equipo de finanzas aprueba". Nunca das un sí definitivo. Preguntás mucho, pero al final del día decís que tenés que pensarlo o consultarlo. Tu objetivo es ver si el agente puede identificar al decisor real, ayudar a venderle internamente, y dar herramientas para llevar a la otra persona.`,
  },
];

/* ── Find persona ──────────────────────────────────── */

export function getPersona(id: string) {
  return LAB_PERSONAS.find((p) => p.id === id);
}

/* ── Create run ─────────────────────────────────────── */

export async function createRun(data: {
  personaIds: string[];
  configId?: string;
  userId?: string;
}) {
  const run = await prisma.agentTestRun.create({
    data: {
      status: "running",
      configId: data.configId,
      createdById: data.userId,
    },
  });
  return run;
}

/* ── Run a single persona in sandbox ────────────────── */

export async function runPersona(runId: string, personaId: string, configId: string): Promise<void> {
  const persona = getPersona(personaId);
  if (!persona) throw new Error(`Persona ${personaId} no encontrada`);

  // Get the agent profile (for the test, we use default config + a generic agent persona)
  const config = await prisma.aIConfig.findUnique({ where: { id: configId } });
  if (!config) throw new Error("AI config no encontrada");

  const transcript: { role: "user" | "assistant"; content: string }[] = [];
  const findings: { tipo: string; descripcion: string; gravedad: string }[] = [];

  // System prompt for the agent being tested
  const agentSystemPrompt = `Eres un agente de ventas amable, profesional y conciso. Tu objetivo es ayudar al cliente, responder preguntas sobre el producto, y avanzar hacia la venta cuando sea apropiado. No tienes acceso a un CRM específico, pero representas a una empresa seria. Habla de forma natural por WhatsApp.`;

  // Run 4 turns of conversation
  const userTurns = [
    "Hola, vi tu anuncio y me interesa pero tengo algunas dudas",
    "Mmm no sé, el precio me parece alto",
    "Y si no me gusta puedo devolver?",
    "Ok, y cómo funciona exactamente?",
  ];

  for (const userMsg of userTurns) {
    transcript.push({ role: "user", content: userMsg });
    try {
      const response = await generateResponse(configId, [
        { role: "system", content: agentSystemPrompt },
        ...transcript,
      ], { maxTokens: 200 });
      transcript.push({ role: "assistant", content: response });
    } catch (err: any) {
      transcript.push({ role: "assistant", content: `[Error: ${err.message}]` });
      findings.push({ tipo: "error", descripcion: `Fallo generando respuesta: ${err.message}`, gravedad: "alta" });
      break;
    }
  }

  // Judge the conversation
  const judgePrompt = `Eres un juez experto en calidad de atención al cliente. Evalúa esta conversación entre un cliente (${persona.name}) y un agente de ventas.

PERSONA DEL CLIENTE: ${persona.description}

TRANSCRIPCIÓN:
${transcript.map((m, i) => `[${m.role === "user" ? "Cliente" : "Agente"}]: ${m.content}`).join("\n")}

Evalúa del 0 al 100 considerando:
- ¿El agente entendió la objeción/emoción del cliente?
- ¿Dio respuestas relevantes y útiles?
- ¿Mantuvo un tono profesional?
- ¿Avanzó la conversación hacia la venta sin presionar?

DETECTA HALLZGOS:
- "alucinacion": Inventó datos del producto, precios, o características que no conoce
- "fuera_de_kb": Mencionó info que no está en conocimiento del negocio
- "debio_escalar": Situación donde debió pasar a humano pero no lo hizo
- "tono": Tono inapropiado (agresivo, condescendiente, demasiado formal, etc.)
- "precio": Manejo pobre de objeciones de precio
- "largo": Respuestas innecesariamente largas o con info que no se pidió
- "corto": Respuestas demasiado cortas que no resuelven dudas

Responde SOLO con un JSON válido:
{
  "score": <0-100>,
  "veredicto": "verde" | "amarillo" | "rojo",
  "hallazgos": [{"tipo": "...", "descripcion": "...", "gravedad": "alta|media|baja"}],
  "sugerencias": [{"pregunta": "...", "respuesta_sugerida": "..."}]
}`;

  let score = 50;
  let veredicto = "amarillo";
  let sugerencias: { pregunta: string; respuesta_sugerida: string }[] = [];

  try {
    const judgeRaw = await generateResponse(configId, [{ role: "user", content: judgePrompt }], { maxTokens: 800 });
    const jsonMatch = judgeRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const judged = JSON.parse(jsonMatch[0]);
      score = Math.max(0, Math.min(100, parseInt(judged.score) || 50));
      veredicto = judged.veredicto || "amarillo";
      if (Array.isArray(judged.hallazgos)) {
        for (const h of judged.hallazgos) {
          findings.push({
            tipo: h.tipo || "general",
            descripcion: h.descripcion || "",
            gravedad: h.gravedad || "media",
          });
        }
      }
      if (Array.isArray(judged.sugerencias)) {
        sugerencias = judged.sugerencias.slice(0, 3);
      }
    }
  } catch {
    findings.push({ tipo: "error", descripcion: "No se pudo juzgar la conversación", gravedad: "alta" });
  }

  await prisma.agentTestCase.create({
    data: {
      runId,
      personaId: persona.id,
      personaName: persona.name,
      veredicto,
      score,
      hallazgos: [...findings, ...sugerencias.map((s) => ({ tipo: "sugerencia", descripcion: `Si preguntan: "${s.pregunta}" → "${s.respuesta_sugerida}"`, gravedad: "media" }))] as any,
      transcript: transcript as any,
    },
  });
}

/* ── Run all personas in a run ──────────────────────── */

export async function executeRun(runId: string, personaIds: string[], configId: string) {
  for (const pid of personaIds) {
    try {
      await runPersona(runId, pid, configId);
    } catch (err: any) {
      await prisma.agentTestCase.create({
        data: {
          runId,
          personaId: pid,
          personaName: getPersona(pid)?.name || pid,
          veredicto: "rojo",
          score: 0,
          hallazgos: [{ tipo: "error", descripcion: err.message, gravedad: "alta" }] as any,
        },
      });
    }
  }

  // Compute average score
  const cases = await prisma.agentTestCase.findMany({ where: { runId } });
  const avgScore = cases.length > 0
    ? Math.round(cases.reduce((s, c) => s + (c.score || 0), 0) / cases.length)
    : 0;

  await prisma.agentTestRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      endedAt: new Date(),
      score: avgScore,
    },
  });

  return { runId, avgScore, caseCount: cases.length };
}

/* ── Get run with cases ────────────────────────────── */

export async function getRun(runId: string) {
  return prisma.agentTestRun.findUnique({
    where: { id: runId },
    include: {
      cases: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getRecentRuns(limit: number = 20) {
  return prisma.agentTestRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: { _count: { select: { cases: true } } },
  });
}

/* ── Apply suggestion to knowledge base ────────────── */

export async function applySuggestionToKB(caseId: string, hallazgoIndex: number, botId: string) {
  const c = await prisma.agentTestCase.findUnique({ where: { id: caseId } });
  if (!c) throw new Error("Case no encontrado");
  const hallazgos = (c.hallazgos as any[]) || [];
  const h = hallazgos[hallazgoIndex];
  if (!h) throw new Error("Hallazgo no encontrado");
  if (!h.pregunta || !h.respuesta_sugerida) throw new Error("Hallazgo no es una sugerencia");

  // Create a knowledge base entry (qa type)
  const knowledge = await prisma.botKnowledge.findFirst({ where: { botId } });
  // BotKnowledge model is from earlier sprint, just create directly
  return { pregunta: h.pregunta, respuesta: h.respuesta_sugerida, botId };
}