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
import { checkFollowUps } from "./services/followup.service";
import { checkScheduledBroadcasts } from "./services/broadcast.service";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { execSync } from "child_process";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://whatsapp:whatsapp_secret@whatsapp-db:5432/whatsapp_panel";
  console.warn("DATABASE_URL no definida, usando fallback interno");
}
const prisma = new PrismaClient();

async function seedDatabase() {
  console.log("=== Iniciando seed ===");
  // Admin User
  try {
    const existingAdmin = await prisma.user.findUnique({ where: { email: "admin@whatsapp-panel.com" } });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 12);
      await prisma.user.create({ data: { email: "admin@whatsapp-panel.com", password: hashedPassword, name: "Administrador", role: "ADMIN" } });
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
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

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

  socket.on("disconnect", () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Follow-up cron job (every 5 minutes)
setInterval(checkFollowUps, 5 * 60 * 1000);

// Broadcast cron job (every minute)
setInterval(checkScheduledBroadcasts, 60 * 1000);

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
  await seedDatabase();
  server.listen(PORT, () => {
    console.log(`Backend corriendo en http://localhost:${PORT}`);
    console.log(`Socket.io listo`);
    console.log(`Follow-up cron activo (cada 5 min)`);
  });
}

start();
