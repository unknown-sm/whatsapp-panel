import prisma from "../lib/prisma";
import { z } from "zod";
import { sendWhatsAppMessage } from "./whatsapp.service";
import { addScoreByCondition } from "./leadscore.service";
import { io } from "../index";

export async function getFollowUpRules(botId?: string, orgId?: string) {
  const where: any = {};
  if (botId) where.botId = botId;
  if (orgId) where.orgId = orgId;
  return prisma.followUpRule.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function createFollowUpRule(data: any) {
  const parsed = z.object({
    botId: z.string().uuid(),
    stepId: z.string().uuid().optional(),
    delayHours: z.number().int().min(1),
    maxAttempts: z.number().int().min(1).max(5).default(3),
    message: z.string().min(1),
    isActive: z.boolean().default(true),
    orgId: z.string().optional(),
  }).parse(data);

  return prisma.followUpRule.create({ data: parsed });
}

export async function updateFollowUpRule(id: string, data: any) {
  return prisma.followUpRule.update({ where: { id }, data });
}

export async function deleteFollowUpRule(id: string) {
  return prisma.followUpRule.delete({ where: { id } });
}

export async function getFollowUpStats() {
  const rules = await prisma.followUpRule.findMany({ include: { bot: true } });
  const stats = [];

  for (const rule of rules) {
    const attempts = await prisma.followUpAttempt.count({ where: { ruleId: rule.id } });
    const replied = await prisma.followUpAttempt.count({ where: { ruleId: rule.id, replied: true } });
    stats.push({
      ruleId: rule.id,
      botName: rule.bot.name,
      totalAttempts: attempts,
      reEngaged: replied,
      rate: attempts > 0 ? Math.round((replied / attempts) * 100) : 0,
    });
  }

  return stats;
}

// Cron job: check for follow-ups to send
export async function checkFollowUps() {
  const rules = await prisma.followUpRule.findMany({ where: { isActive: true } });

  for (const rule of rules) {
    // Find conversations that need follow-up
    const cutoffDate = new Date(Date.now() - rule.delayHours * 60 * 60 * 1000);

    const conversations = await prisma.conversation.findMany({
      where: {
        botId: rule.botId,
        status: "active",
        updatedAt: { lt: cutoffDate },
      },
      include: {
        contact: true,
        followUpAttempts: { where: { ruleId: rule.id } },
      },
    });

    for (const conv of conversations) {
      const attemptCount = conv.followUpAttempts.length;
      if (attemptCount >= rule.maxAttempts) {
        // Mark as no response
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { status: "waiting_agent" },
        });
        io.emit("conversation:updated", { id: conv.id, status: "waiting_agent" });
        continue;
      }

      // Send follow-up message
      const sent = await sendWhatsAppMessage(conv.contact.phone, rule.message);
      if (sent) {
        await prisma.followUpAttempt.create({
          data: {
            conversationId: conv.id,
            ruleId: rule.id,
            attemptNumber: attemptCount + 1,
          },
        });

        await prisma.message.create({
          data: {
            conversationId: conv.id,
            direction: "outbound",
            type: "text",
            content: rule.message,
          },
        });

        io.emit("message:new", {
          conversationId: conv.id,
          content: rule.message,
          direction: "outbound",
          timestamp: new Date().toISOString(),
        });
        // Lead scoring: MESSAGE_SENT
        addScoreByCondition(conv.orgId || "", conv.contactId, "MESSAGE_SENT", "Follow-up enviado").catch(() => {});
      }
    }
  }
}
