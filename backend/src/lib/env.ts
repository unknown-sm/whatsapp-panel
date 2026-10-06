import crypto from "crypto";

let devSecret: string | null = null;

/**
 * JWT signing/verification secret.
 * In production JWT_SECRET is mandatory: the caller throws (or the server
 * refuses to boot) instead of silently falling back to a known value.
 * In development a random ephemeral secret is generated so sessions simply
 * don't survive a restart.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET es obligatoria en produccion. Definila y reinicia; no se usa ningun valor por defecto.");
  }
  if (!devSecret) {
    devSecret = crypto.randomBytes(32).toString("hex");
    console.warn("[env] JWT_SECRET no definida: usando secreto efimero de desarrollo (las sesiones se pierden al reiniciar).");
  }
  return devSecret;
}
