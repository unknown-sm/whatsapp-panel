import { Request, Response } from "express";

/**
 * Devuelve el orgId del usuario autenticado o responde 403 y retorna null.
 * Uso: const orgId = requireOrgId(req, res); if (!orgId) return;
 */
export function requireOrgId(req: Request, res: Response): string | null {
  const orgId = (req as any).user?.orgId;
  if (!orgId) {
    res.status(403).json({ error: "Usuario sin organización asignada" });
    return null;
  }
  return orgId;
}
