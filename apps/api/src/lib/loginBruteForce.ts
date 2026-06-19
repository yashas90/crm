import { createHash } from "node:crypto";
import rateLimit, { ipKeyGenerator, MemoryStore } from "express-rate-limit";
import type { Context, Next } from "hono";
import { getClientIp } from "./clientIp.js";

export const LOGIN_RATE_LIMIT_MESSAGE = "Too many login attempts. Try again in 15 minutes.";
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = 10;

const loginIpStore = new MemoryStore();

type EmailAttemptBucket = { count: number; expiresAt: number };

const emailAttempts = new Map<string, EmailAttemptBucket>();

/** express-rate-limit — max 5 login attempts per IP per 15 minutes. */
export const loginIpRateLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: LOGIN_RATE_LIMIT_MESSAGE,
  skipSuccessfulRequests: false,
  validate: { ip: false, trustProxy: false },
  keyGenerator: (req) =>
    ipKeyGenerator(String(req.ip ?? req.socket?.remoteAddress ?? "127.0.0.1")),
  store: loginIpStore,
});

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

/** @internal Test helper */
export function resetLoginBruteForceForTests(): void {
  emailAttempts.clear();
  loginIpStore.resetAll();
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

/** Adapts express-rate-limit middleware for Hono login routes. */
export function honoLoginIpRateLimit() {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c) ?? "127.0.0.1";

    let limited = false;
    await new Promise<void>((resolve) => {
      const req = {
        ip,
        headers: {},
        method: c.req.method,
        socket: { remoteAddress: ip },
      } as Parameters<typeof loginIpRateLimiter>[0];

      let statusCode = 200;
      const res = {
        statusCode,
        status(code: number) {
          statusCode = code;
          return this;
        },
        setHeader() {
          return this;
        },
        getHeader() {
          return undefined;
        },
        json() {
          if (statusCode === 429) limited = true;
          resolve();
        },
        send() {
          if (statusCode === 429) limited = true;
          resolve();
        },
        end() {
          resolve();
        },
      } as unknown as Parameters<typeof loginIpRateLimiter>[1];

      loginIpRateLimiter(req, res, () => resolve());
    });

    if (limited) {
      return loginRateLimitResponse(c);
    }

    await next();
  };
}

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
