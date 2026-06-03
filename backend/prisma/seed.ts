import prisma from "../src/lib/prisma";
import bcrypt from "bcrypt";

async function seed() {
  console.log("Seeding database...");
  const existingAdmin = await prisma.user.findUnique({ where: { email: "admin@whatsapp-panel.com" } });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("admin123", 12);
    await prisma.user.create({ data: { email: "admin@whatsapp-panel.com", password: hashedPassword, name: "Administrador", role: "ADMIN" } });
    console.log("Admin creado: admin@whatsapp-panel.com / admin123");
  } else {
    console.log("Admin ya existe");
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const existing = await prisma.aIConfig.findFirst({ where: { provider: "openai", isDefault: true } });
    if (!existing) {
      await prisma.aIConfig.create({
        data: {
          name: "OpenAI Default",
          provider: "openai",
          apiKey: openaiKey,
          model: "gpt-4o",
          isDefault: true,
          isActive: true,
        },
      });
      console.log("OpenAI AIConfig creada desde OPENAI_API_KEY");
    } else {
      console.log("AIConfig OpenAI ya existe");
    }
  }

  console.log("Seed completado");
}

seed().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });