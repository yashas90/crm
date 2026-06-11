import type { Context, Next } from "hono";
import { incrementRateLimit } from "../lib/rateLimitStore.js";
import { jsonError } from "../lib/response.js";
import type { AuthUser } from "../middleware/auth.js";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function rateLimitKey(parts: string[]): string {
  return `rl:${parts.join(":")}`;
}

async function enforceLimit(
  c: Context,
  key: string,
  options: { limit: number; windowMs: number },
): Promise<Response | null> {
  const count = await incrementRateLimit(key, options.windowMs);

  if (count > options.limit) {
    return jsonError(c, "RATE_LIMITED", "Too many requests. Please slow down and try again.", 429);
  }

  return null;
}

export function createUserRateLimiter(options: {
  limit: number;
  windowMs: number;
  bucket: string;
}) {
  return async (c: Context, next: Next) => {
    if (!WRITE_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    const authUser = c.get("authUser") as AuthUser | undefined;
    if (!authUser) {
      await next();
      return;
    }

    const key = rateLimitKey([authUser.id, options.bucket]);
    const limited = await enforceLimit(c, key, options);
    if (limited) return limited;

    await next();
  };
}

function resolveClientIp(c: Context) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("x-real-ip")?.trim() || "unknown";
}

/** IP-based limiter for unauthenticated public endpoints (e.g. login, Meta webhooks). */
export function createIpRateLimiter(options: {
  limit: number;
  windowMs: number;
  bucket: string;
}) {
  return async (c: Context, next: Next) => {
    const ip = resolveClientIp(c);
    const key = rateLimitKey(["ip", options.bucket, ip]);
    const limited = await enforceLimit(c, key, options);
    if (limited) return limited;

    await next();
  };
}

/** 60 writes/minute per user — POST /api/leads */
export const leadsCreateRateLimit = createUserRateLimiter({
  limit: 60,
  windowMs: 60_000,
  bucket: "leads:post",
});

/** 60 writes/minute per user — PATCH /api/leads/:id */
export const leadsPatchRateLimit = createUserRateLimiter({
  limit: 60,
  windowMs: 60_000,
  bucket: "leads:patch",
});

/** 60 writes/minute per user — POST /api/calls/log */
export const callsLogRateLimit = createUserRateLimiter({
  limit: 60,
  windowMs: 60_000,
  bucket: "calls:log",
});

/** Generic write limiter for other mutating routes (projects, users, etc.). */
export const writeRateLimit = createUserRateLimiter({
  limit: 60,
  windowMs: 60_000,
  bucket: "write",
});

/** Lighter IP limit on login attempts. */
export const loginRateLimit = createIpRateLimiter({
  limit: 20,
  windowMs: 60_000,
  bucket: "auth:login",
});

export const metaWebhookRateLimit = createIpRateLimiter({
  limit: 120,
  windowMs: 60_000,
  bucket: "meta-webhook",
});
