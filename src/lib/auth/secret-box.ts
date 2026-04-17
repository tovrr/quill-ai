import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SECRET_PREFIX = "quill-v1";

function getSecretMaterial(): string {
  const fromEnv = process.env.MCP_OAUTH_ENCRYPTION_KEY?.trim();
  if (fromEnv) return fromEnv;

  const fallback = process.env.BETTER_AUTH_SECRET?.trim();
  if (fallback) return fallback;

  throw new Error("oauth_secret_missing");
}

function getKey(): Buffer {
  return createHash("sha256").update(getSecretMaterial()).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    SECRET_PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(cipherText: string): string {
  const parts = cipherText.split(":");
  if (parts.length !== 4 || parts[0] !== SECRET_PREFIX) {
    throw new Error("oauth_secret_invalid_format");
  }

  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const encrypted = Buffer.from(parts[3], "base64");

  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
