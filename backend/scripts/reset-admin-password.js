const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "admin@whatsapp-panel.com";
  const password = process.argv[3] || "admin123";

  const hashed = await bcrypt.hash(password, 12);

  const org = await prisma.organization.findFirst();

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, isActive: true },
    create: {
      email,
      password: hashed,
      name: "Administrador",
      role: "ADMIN",
      memberships: org
        ? { create: { orgId: org.id, role: "ADMIN", isDefault: true } }
        : undefined,
    },
  });

  console.log("Password reset OK");
  console.log("  email:    " + email);
  console.log("  password: " + password);
  console.log("  userId:   " + user.id);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
