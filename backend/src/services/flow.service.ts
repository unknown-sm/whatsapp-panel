import prisma from "../lib/prisma";
import { z } from "zod";

const stepTypeSchema = z.enum([
  "TEXT", "AI_AGENT", "HTTP_REQUEST", "INTENT", "SILENCE",
  "CALENDAR", "VOICE_AI", "STRUCTURED_OUTPUT", "FORWARD",
]);

const responseTypeSchema = z.enum(["FREE_TEXT", "BUTTONS", "YES_NO", "NONE"]);

const createStepSchema = z.object({
  order: z.number().int().min(0),
  stepType: stepTypeSchema,
  message: z.string().optional(),
  waitSeconds: z.number().int().min(0).default(0),
  responseType: responseTypeSchema.optional(),
  responseCapture: z.string().optional(),
  config: z.record(z.any()).optional(),
});

const updateStepSchema = z.object({
  order: z.number().int().min(0).optional(),
  stepType: stepTypeSchema.optional(),
  message: z.string().optional(),
  waitSeconds: z.number().int().min(0).optional(),
  responseType: responseTypeSchema.optional(),
  responseCapture: z.string().optional(),
  config: z.record(z.any()).optional(),
});

export async function getFlowSteps(botId: string) {
  return prisma.flowStep.findMany({
    where: { botId },
    include: { media: true, intentRoutes: true, httpRoutes: true },
    orderBy: { order: "asc" },
  });
}

export async function createStep(botId: string, data: any) {
  const parsed = createStepSchema.parse(data);
  const maxOrder = await prisma.flowStep.count({ where: { botId } });
  return prisma.flowStep.create({
    data: {
      botId,
      order: parsed.order ?? maxOrder,
      stepType: parsed.stepType,
      message: parsed.message,
      waitSeconds: parsed.waitSeconds,
      responseType: parsed.responseType,
      responseCapture: parsed.responseCapture,
      config: parsed.config ? (parsed.config as any) : undefined,
    },
    include: { media: true, intentRoutes: true, httpRoutes: true },
  });
}

export async function updateStep(id: string, data: any) {
  const parsed = updateStepSchema.parse(data);
  return prisma.flowStep.update({
    where: { id },
    data: {
      order: parsed.order,
      stepType: parsed.stepType,
      message: parsed.message,
      waitSeconds: parsed.waitSeconds,
      responseType: parsed.responseType,
      responseCapture: parsed.responseCapture,
      config: parsed.config ? (parsed.config as any) : undefined,
    },
    include: { media: true, intentRoutes: true, httpRoutes: true },
  });
}

export async function deleteStep(id: string) {
  return prisma.flowStep.delete({ where: { id } });
}

export async function reorderSteps(botId: string, stepIds: string[]) {
  const updates = stepIds.map((id, index) =>
    prisma.flowStep.update({ where: { id }, data: { order: index } })
  );
  return prisma.$transaction(updates);
}

export async function addIntentRoute(stepId: string, label: string, samples: string[], nextStepId?: string) {
  return prisma.intentRoute.create({
    data: { stepId, label, samples, nextStepId },
  });
}

export async function removeIntentRoute(id: string) {
  return prisma.intentRoute.delete({ where: { id } });
}
