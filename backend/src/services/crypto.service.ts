import crypto from "crypto";
import { getJwtSecret } from "../lib/env";

/* ── AES-256-GCM encryption for sensitive tokens ────────── */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
let warnedEncryptionKey = false;
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    cachedKey = crypto.createHash("sha256").update(envKey).digest();
    return cachedKey;
  }
  // Transitional fallback: derive from JWT_SECRET (never from a public literal).
  // Setting ENCRYPTION_KEY is the recommended setup; changing it later requires
  // re-saving stored tokens.
  if (!warnedEncryptionKey) {
    warnedEncryptionKey = true;
    console.warn("[crypto] ENCRYPTION_KEY no definida (o menor a 32 chars): derivando clave de JWT_SECRET. Defini ENCRYPTION_KEY propia en produccion.");
  }
  cachedKey = crypto.createHash("sha256").update(getJwtSecret()).digest();
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  try {
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = buf.subarray(IV_LENGTH + 16);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch (err) {
    throw new Error("Failed to decrypt value");
  }
}

export function isEncrypted(value: string): boolean {
  // Encrypted values are base64 with specific length patterns
  if (!value || value.length < 40) return false;
  // Plain text tokens usually start with specific prefixes (EAA, ghp, sk-, etc.)
  if (/^(EAA|ghp|gho|ghs|sk-|gsk_|AIza|ya29)/.test(value)) return false;
  try {
    const buf = Buffer.from(value, "base64");
    return buf.length > 28; // IV (12) + tag (16) + at least 1 byte
  } catch {
    return false;
  }
}