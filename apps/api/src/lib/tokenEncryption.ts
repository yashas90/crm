import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env.js";

const ENCRYPTED_PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function encryptionKey(): Buffer {
  const source = env.TOKEN_ENCRYPTION_KEY?.trim() || env.AUTH_JWT_SECRET;
  return createHash("sha256").update(source).digest();
}

/** AES-256-GCM encrypt for OAuth tokens at rest. */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

/** Decrypt tokens; passes through legacy plaintext values. */
export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(ENCRYPTED_PREFIX)) return value;

  const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64url");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
