import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "La contrasena debe tener al menos 6 caracteres"),
});

const registerSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "La contrasena debe tener al menos 6 caracteres"),
  name: z.string().optional(),
  orgName: z.string().min(2, "Nombre de organizacion requerido"),
  orgSlug: z.string().optional(),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32);
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { where: { isDefault: true }, include: { org: true } } },
    });
    if (!user) return res.status(401).json({ error: "Credenciales invalidas" });
    if (!user.isActive) return res.status(403).json({ error: "Cuenta desactivada" });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: "Credenciales invalidas" });

    const defaultMembership = user.memberships[0];
    const orgId = defaultMembership?.orgId;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, orgId },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any }
    );
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, orgName, orgSlug } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email ya registrado" });

    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate unique slug
    let slug = orgSlug || slugify(orgName);
    let counter = 0;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      counter++;
      slug = `${slugify(orgName)}-${counter}`;
    }

    // Create org + user + membership in transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName, slug, plan: "free" },
      });

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: "ADMIN",
          memberships: {
            create: { orgId: org.id, role: "ADMIN", isDefault: true },
          },
        },
        include: { memberships: true },
      });

      return { user, org };
    });

    const token = jwt.sign(
      { id: result.user.id, email: result.user.email, role: result.user.role, orgId: result.org.id },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any }
    );

    res.status(201).json({
      user: { id: result.user.id, email: result.user.email, name: result.user.name, role: "ADMIN", orgId: result.org.id },
      org: { id: result.org.id, name: result.org.name, slug: result.org.slug },
      token,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message || "Error interno" });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { isDefault: true }, include: { org: true } } },
    });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    const defaultOrg = user.memberships[0]?.org;
    res.json({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar, isActive: user.isActive,
        orgId: defaultOrg?.id,
        org: defaultOrg ? { id: defaultOrg.id, name: defaultOrg.name, slug: defaultOrg.slug, plan: defaultOrg.plan } : null,
      },
    });
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
