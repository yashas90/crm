import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

function unsubscribeSecret(): string {
  return env.REPORT_EMAIL_UNSUBSCRIBE_SECRET ?? env.AUTH_JWT_SECRET;
}

function signUserId(userId: string): string {
  return createHmac("sha256", unsubscribeSecret()).update(userId).digest("base64url");
}

export function createReportUnsubscribeToken(userId: string): string {
  return `${userId}.${signUserId(userId)}`;
}

export function verifyReportUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const userId = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!userId || !signature) return null;

  const expected = signUserId(userId);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  return userId;
}

export function buildReportUnsubscribeUrl(userId: string): string {
  const apiBase = (env.API_PUBLIC_URL ?? env.WEB_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const token = createReportUnsubscribeToken(userId);
  return `${apiBase}/api/auth/unsubscribe-reports?token=${encodeURIComponent(token)}`;
}
