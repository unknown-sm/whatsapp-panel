import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import botRoutes from "./routes/bot.routes";
import flowRoutes from "./routes/flow.routes";
import whatsappRoutes from "./routes/whatsapp.routes";
import conversationRoutes from "./routes/conversation.routes";
import followupRoutes from "./routes/followup.routes";
import aiRoutes from "./routes/ai.routes";
import pipelineRoutes from "./routes/pipeline.routes";
import leadScoreRoutes from "./routes/leadscore.routes";
import broadcastRoutes from "./routes/broadcast.routes";
import analyticsRoutes from "./routes/analytics.routes";
import customFieldRoutes from "./routes/customfield.routes";
import openwaRoutes from "./routes/openwa.routes";
import knowledgeRoutes from "./routes/knowledge.routes";
import logsRoutes from "./routes/logs.routes";
import playbookRoutes from "./routes/playbook.routes";
import pushRoutes from "./routes/push.routes";
import routingRoutes from "./routes/routing.routes";
import labRoutes from "./routes/lab.routes";
import templateRoutes from "./routes/template.routes";
import metaOAuthRoutes from "./routes/meta-oauth.routes";
import reportsRoutes from "./routes/reports.routes";
import npsRoutes from "./routes/nps.routes";
import webhookRoutes from "./routes/webhook.routes";
import agentChatRoutes from "./routes/agent-chat.routes";
import { checkFollowUps } from "./services/followup.service";
import * as reportsService from "./services/reports.service";
import { checkScheduledBroadcasts } from "./services/broadcast.service";
import { seedPlaybooks } from "./services/playbook.service";
import { seedRoutingRules } from "./services/routing.service";
import prisma from "./lib/prisma";
import bcrypt from "bcrypt";
import { execSync } from "child_process";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://whatsapp:whatsapp_secret@whatsapp-db:5432/whatsapp_panel";
  console.warn("DATABASE_URL no definida, usando fallback interno");
}

async function seedDatabaseIfEmpty() {
  // Solo correr el seed si la DB está vacía (sin usuarios)
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("=== Seed omitido (DB ya tiene datos) ===");
    return;
  }
  console.log("=== Iniciando seed (DB vacía) ===");
  await seedDatabase();
}

async function seedDatabase() {
  console.log("=== Ejecutando seed ===");

  // Migration: create default org for existing data without orgId
  try {
    const existingOrgs = await prisma.organization.count();
    if (existingOrgs === 0) {
      // Create a default org
      const defaultOrg = await prisma.organization.create({
        data: { name: "Default Organization", slug: "default", plan: "free" },
      });
      console.log(`Default org creado: ${defaultOrg.id}`);

      // Migrate existing data: assign orgId to all rows where it's null
      const updates = [
        prisma.user.updateMany({ where: { role: { in: ["ADMIN", "AGENT"] }, memberships: { none: {} } }, data: {} }),
        prisma.contact.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.conversation.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.bot.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.pipeline.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.deal.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.followUpRule.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.leadScoreRule.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.broadcastTemplate.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.broadcast.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.conversationWindow.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.adAttribution.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.salesPlaybook.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.messageTemplate.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.routingRule.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.report.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
        prisma.npsCampaign.updateMany({ where: { orgId: null }, data: { orgId: defaultOrg.id } }),
      ];
      const results = await Promise.all(updates);
      console.log(`Migrados ${results.length} modelos a default org`);

      // Create membership for existing admin
      const adminUser = await prisma.user.findUnique({ where: { email: "admin@whatsapp-panel.com" } });
      if (adminUser) {
        await prisma.userOrganization.create({
          data: { userId: adminUser.id, orgId: defaultOrg.id, role: "ADMIN", isDefault: true },
        });
        console.log("Admin user asignado a default org");
      }
    }
  } catch (e) {
    console.error("Migration error (continuing):", e instanceof Error ? e.message : e);
  }

  // Admin User
  try {
    const existingAdmin = await prisma.user.findUnique({ where: { email: "admin@whatsapp-panel.com" } });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 12);
      const defaultOrg = await prisma.organization.findFirst();
      await prisma.user.create({
        data: {
          email: "admin@whatsapp-panel.com",
          password: hashedPassword,
          name: "Administrador",
          role: "ADMIN",
          memberships: defaultOrg ? { create: { orgId: defaultOrg.id, role: "ADMIN", isDefault: true } } : undefined,
        },
      });
      console.log("Admin creado: admin@whatsapp-panel.com / admin123");
    } else {
      console.log("Admin ya existe");
    }
    console.log("Seed: Admin User OK");
  } catch (e) {
    console.error("Seed ERROR en Admin User:", e instanceof Error ? e.message : e);
  }

  // Pipeline
  try {
    const existing = await prisma.pipeline.findFirst();
    if (!existing) {
      const pipeline = await prisma.pipeline.create({
        data: {
          name: "Ventas WhatsApp",
          description: "Pipeline de ventas por WhatsApp",
          isDefault: true,
        },
      });
      await prisma.pipelineStage.createMany({
        data: [
          { name: "Nuevo Contacto", pipelineId: pipeline.id, order: 0, color: "#3B82F6" },
          { name: "Calificacion", pipelineId: pipeline.id, order: 1, color: "#8B5CF6" },
          { name: "Propuesta", pipelineId: pipeline.id, order: 2, color: "#F59E0B" },
          { name: "Negociacion", pipelineId: pipeline.id, order: 3, color: "#EF4444" },
          { name: "Cerrado Ganado", pipelineId: pipeline.id, order: 4, color: "#10B981" },
          { name: "Cerrado Perdido", pipelineId: pipeline.id, order: 5, color: "#6B7280" },
        ],
      });
      console.log("Pipeline por defecto creado: Ventas WhatsApp");
    }
    console.log("Seed: Pipeline OK");
  } catch (e) {
    console.error("Seed ERROR en Pipeline:", e instanceof Error ? e.message : e);
    throw e;
  }

  // Contacts
  try {
    const contactCount = await prisma.contact.count();
    if (contactCount === 0) {
      await prisma.contact.createMany({
        data: [
          { phone: "595981123456", name: "Juan Perez" },
          { phone: "595981234567", name: "Maria Lopez" },
          { phone: "595981345678", name: "Carlos Gonzalez" },
          { phone: "595981456789", name: "Ana Martinez" },
          { phone: "595981567890", name: "Pedro Rodriguez" },
          { phone: "595981678901", name: "Laura Silva" },
          { phone: "595981789012", name: "Diego Fernandez" },
          { phone: "595981890123", name: "Sofia Ruiz" },
          { phone: "595981901234", name: "Andres Castro" },
          { phone: "595982012345", name: "Carmen Vazquez" },
        ],
      });
      console.log("10 contactos creados");
    }
    console.log("Seed: Contacts OK");
  } catch (e) {
    console.error("Seed ERROR en Contacts:", e instanceof Error ? e.message : e);
    throw e;
  }

  // Bots
  try {
    const botCount = await prisma.bot.count();
    if (botCount === 0) {
      await prisma.bot.createMany({
        data: [
          { name: "Soporte General", isActive: true },
          { name: "Ventas", isActive: true },
          { name: "Marketing", isActive: true },
        ],
      });
      console.log("3 bots creados");
    }
    console.log("Seed: Bots OK");
  } catch (e) {
    console.error("Seed ERROR en Bots:", e instanceof Error ? e.message : e);
    throw e;
  }

  // Conversations & Messages
  try {
    const conversationCount = await prisma.conversation.count();
    if (conversationCount === 0) {
      const allContacts = await prisma.contact.findMany({ select: { id: true, name: true, phone: true }, take: 5 });
      const allBots = await prisma.bot.findMany({ select: { id: true, name: true } });
      if (allContacts.length > 0 && allBots.length > 0) {
        for (let i = 0; i < Math.min(5, allContacts.length); i++) {
          const contact = allContacts[i];
          const bot = allBots[i % allBots.length];
          const conversation = await prisma.conversation.create({
            data: {
              contactId: contact.id,
              botId: bot.id,
              status: "active",
            },
          });
          await prisma.message.createMany({
            data: [
              { conversationId: conversation.id, direction: "inbound", content: `Hola, soy ${contact.name?.split(" ")[0] || "Juan"}. Tengo una consulta.`, type: "text" },
              { conversationId: conversation.id, direction: "outbound", content: `¡Hola! Soy el bot ${bot.name}. ¿En qué puedo ayudarte?`, type: "text" },
              { conversationId: conversation.id, direction: "inbound", content: "Quiero saber más sobre sus productos.", type: "text" },
              { conversationId: conversation.id, direction: "outbound", content: "Claro, te envío la información en seguida.", type: "text" },
            ],
          });
        }
        console.log(`${Math.min(5, allContacts.length)} conversaciones con mensajes creadas`);
      }
    }
    console.log("Seed: Conversations OK");
  } catch (e) {
    console.error("Seed ERROR en Conversations:", e instanceof Error ? e.message : e);
    throw e;
  }

  // Lead Score Rules
  try {
    const ruleCount = await prisma.leadScoreRule.count();
    if (ruleCount === 0) {
      await prisma.leadScoreRule.createMany({
        data: [
          { name: "Mensaje Recibido", condition: "MESSAGE_RECEIVED", points: 5, isActive: true },
          { name: "Conversacion Cerrada", condition: "CONVERSATION_CLOSED", points: 15, isActive: true },
          { name: "Deal Ganado", condition: "DEAL_WON", points: 50, isActive: true },
        ],
      });
      console.log("3 reglas de lead scoring creadas");
    }
    console.log("Seed: LeadScore OK");
  } catch (e) {
    console.error("Seed ERROR en LeadScore:", e instanceof Error ? e.message : e);
    throw e;
  }

  // Custom Fields
  try {
    const fieldCount = await prisma.customField.count();
    if (fieldCount === 0) {
      await prisma.customField.createMany({
        data: [
          { name: "Empresa", fieldType: "TEXT", entityType: "CONTACT", isActive: true },
          { name: "Ciudad", fieldType: "SELECT", entityType: "CONTACT", options: ["Asuncion", "Encarnacion", "Ciudad del Este"], isActive: true },
          { name: "VIP", fieldType: "BOOLEAN", entityType: "CONTACT", isActive: true },
          { name: "Notas Internas", fieldType: "TEXT", entityType: "DEAL", isActive: true },
        ],
      });
      console.log("4 campos personalizados creados");
    }
    console.log("Seed: CustomFields OK");
  } catch (e) {
    console.error("Seed ERROR en CustomFields:", e instanceof Error ? e.message : e);
    throw e;
  }

  // Sales Playbooks
  try {
    await seedPlaybooks();
    console.log("Seed: Playbooks OK");
  } catch (e) {
    console.error("Seed ERROR en Playbooks:", e instanceof Error ? e.message : e);
  }

  // Routing Rules
  try {
    await seedRoutingRules();
    console.log("Seed: Routing OK");
  } catch (e) {
    console.error("Seed ERROR en Routing:", e instanceof Error ? e.message : e);
  }
}

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 4000;

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(helmet());
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// Rate limit global (100 req/min per IP)
app.use(require("./routes/auth.routes").globalLimiter);

// Serve frontend static files in production
const frontendDist = path.join(__dirname, "../../frontend/dist");
if (process.env.NODE_ENV === "production" || process.env.SERVE_FRONTEND === "true") {
  app.use(express.static(frontendDist));
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/bots", botRoutes);
app.use("/api/bots", flowRoutes);
app.use("/api/bots/:botId/knowledge", knowledgeRoutes);
app.use("/webhook", whatsappRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/followup", followupRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/pipeline", pipelineRoutes);
app.use("/api/leadscore", leadScoreRoutes);
app.use("/api/broadcast", broadcastRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/customfields", customFieldRoutes);
app.use("/api/openwa", openwaRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/playbooks", playbookRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/routing", routingRoutes);
app.use("/api/lab", labRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/whatsapp", metaOAuthRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/nps", npsRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/agent-chat", agentChatRoutes);

// SPA fallback: send index.html for any non-API route
if (process.env.NODE_ENV === "production" || process.env.SERVE_FRONTEND === "true") {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// Socket.io
io.on("connection", (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on("join-conversation", (conversationId: string) => {
    socket.join(conversationId);
  });

  socket.on("message:send", async (data: { conversationId: string; content: string }) => {
    const { conversationId, content } = data;
    io.to(conversationId).emit("message:new", {
      conversationId,
      content,
      direction: "outbound",
      timestamp: new Date().toISOString(),
    });
  });

  // Agent-to-agent chat
  socket.on("agent-chat:message", (msg) => {
    // Broadcast to all connected clients (frontend filters by org)
    socket.broadcast.emit("agent-chat:received", msg);
  });

  socket.on("disconnect", () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Follow-up cron job (every 5 minutes)
setInterval(checkFollowUps, 5 * 60 * 1000);

// Broadcast cron job (every minute)
setInterval(checkScheduledBroadcasts, 60 * 1000);

// Reports cron job (every hour, generates daily report at 8am)
setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 8 && now.getMinutes() < 5) {
    try {
      await reportsService.saveReport("daily");
      console.log("Daily report auto-generated");
    } catch (err) {
      console.error("Report cron error:", err);
    }
  }
}, 5 * 60 * 1000);

export { io };

async function start() {
  console.log("=== Iniciando prisma db push ===");
  console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);
  try {
    execSync("npx prisma db push --accept-data-loss", { cwd: __dirname + "/../", stdio: "inherit" });
    console.log("=== prisma db push OK ===");
  } catch (e) {
    console.error("Error en prisma db push:", e instanceof Error ? e.message : e);
  }
  await seedDatabaseIfEmpty();
  server.listen(PORT, () => {
    console.log(`Backend corriendo en http://localhost:${PORT}`);
    console.log(`Socket.io listo`);
    console.log(`Follow-up cron activo (cada 5 min)`);
  });
}

start();
