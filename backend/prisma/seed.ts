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
  console.log("Seed completado");
}

seed().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });