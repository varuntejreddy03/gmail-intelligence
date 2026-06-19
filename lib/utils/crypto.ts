import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { requireEnv } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";

/** Derives a stable 256-bit encryption key from TOKEN_ENCRYPTION_KEY. */
function getKey(): Buffer {
  return createHash("sha256").update(requireEnv("TOKEN_ENCRYPTION_KEY")).digest();
}

/** Encrypts an OAuth token using AES-256-GCM. */
export function encryptToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((value) => value.toString("base64url")).join(".");
}

/** Decrypts an AES-256-GCM OAuth token. */
export function decryptToken(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Encrypted token has an invalid format");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
