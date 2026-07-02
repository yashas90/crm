import { createHash } from "node:crypto";
import type { Context, Next } from "hono";

export const LOGIN_RATE_LIMIT_MESSAGE =
  "Too many failed sign-in attempts for this email. Wait 15 minutes or ask your admin to reset.";
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/** Failed attempts per email before temporary lockout (successful login clears the counter). */
const EMAIL_MAX_ATTEMPTS = 30;

type EmailAttemptBucket = { count: number; expiresAt: number };

const emailAttempts = new Map<string, EmailAttemptBucket>();

export function hashEmailForAudit(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

function pruneExpiredEmailBuckets(now: number): void {
  if (emailAttempts.size < 500) return;
  for (const [key, bucket] of emailAttempts) {
    if (now >= bucket.expiresAt) {
      emailAttempts.delete(key);
    }
  }
}

export function recordEmailLoginAttempt(email: string): {
  limited: boolean;
  count: number;
  shouldAlertAdmin: boolean;
} {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  pruneExpiredEmailBuckets(now);

  let bucket = emailAttempts.get(key);
  if (!bucket || now >= bucket.expiresAt) {
    bucket = { count: 0, expiresAt: now + LOGIN_WINDOW_MS };
    emailAttempts.set(key, bucket);
  }

  bucket.count += 1;

  return {
    limited: bucket.count > EMAIL_MAX_ATTEMPTS,
    count: bucket.count,
    shouldAlertAdmin: bucket.count === EMAIL_MAX_ATTEMPTS,
  };
}

export function isEmailLoginLimited(email: string): boolean {
  const key = email.trim().toLowerCase();
  const bucket = emailAttempts.get(key);
  if (!bucket) return false;
  if (Date.now() >= bucket.expiresAt) {
    emailAttempts.delete(key);
    return false;
  }
  return bucket.count >= EMAIL_MAX_ATTEMPTS;
}

/** Reset email counter after a successful login. */
export function clearEmailLoginAttempts(email: string): void {
  emailAttempts.delete(email.trim().toLowerCase());
}

/** Clear all login lockout counters (admin action or API restart). */
export function clearAllLoginRateLimits(): number {
  const cleared = emailAttempts.size;
  emailAttempts.clear();
  return cleared;
}

/** @internal Test helper */
export function resetLoginBruteForceForTests(): void {
  clearAllLoginRateLimits();
}

function loginRateLimitResponse(c: Context): Response {
  c.header("Retry-After", String(Math.ceil(LOGIN_WINDOW_MS / 1000)));
  return c.json(
    {
      ok: false,
      error: { code: "RATE_LIMITED", message: LOGIN_RATE_LIMIT_MESSAGE },
    },
    429,
  );
}

/** Per-email failed-attempt limit only — office Wi‑Fi shares one IP across agents. */
export function loginEmailRateLimit() {
  return async (c: Context, next: Next) => {
    let email: string | undefined;
    try {
      const clone = c.req.raw.clone();
      const body = (await clone.json()) as { email?: string };
      email = typeof body.email === "string" ? body.email : undefined;
    } catch {
      await next();
      return;
    }

    if (email && isEmailLoginLimited(email)) {
      return loginRateLimitResponse(c);
    }

    await next();
  };
}
