import type { Context, Next } from "hono";
import { incrementRateLimit } from "../lib/rateLimitStore.js";
import { jsonError } from "../lib/response.js";
import type { AuthUser } from "../middleware/auth.js";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const ONE_MINUTE_MS = 60_000;

function rateLimitKey(parts: string[]): string {
  return `rl:${parts.join(":")}`;
}

function retryAfterSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

async function enforceLimit(
  c: Context,
  key: string,
  options: { limit: number; windowMs: number },
): Promise<Response | null> {
  const count = await incrementRateLimit(key, options.windowMs);

  if (count > options.limit) {
    c.header("Retry-After", String(retryAfterSeconds(options.windowMs)));
    return jsonError(c, "RATE_LIMITED", "Too many requests. Please slow down and try again.", 429);
  }

  return null;
}

function shouldSkipRateLimit(c: Context): boolean {
  if (c.req.method === "OPTIONS") return true;

  const path = new URL(c.req.url).pathname;
  if (path === "/health" || path.startsWith("/health/")) return true;

  return false;
}

function resolveClientIp(c: Context) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("x-real-ip")?.trim() || "unknown";
}

function hasBearerToken(c: Context): boolean {
  return c.req.header("Authorization")?.startsWith("Bearer ") ?? false;
}

export function createUserRateLimiter(options: {
  limit: number;
  windowMs: number;
  bucket: string;
  methods?: "write" | "all";
}) {
  const methods = options.methods ?? "write";

  return async (c: Context, next: Next) => {
    if (methods === "write" && !WRITE_METHODS.has(c.req.method)) {
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

export function createIpRateLimiter(options: {
  limit: number;
  windowMs: number;
  bucket: string;
  methods?: "write" | "all";
}) {
  const methods = options.methods ?? "all";

  return async (c: Context, next: Next) => {
    if (methods === "write" && !WRITE_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    const ip = resolveClientIp(c);
    const key = rateLimitKey(["ip", options.bucket, ip]);
    const limited = await enforceLimit(c, key, options);
    if (limited) return limited;

    await next();
  };
}

/** 100 requests/minute per IP on unauthenticated public traffic (login, Meta webhooks, etc.). */
export async function publicIpRateLimitMiddleware(c: Context, next: Next) {
  if (shouldSkipRateLimit(c) || hasBearerToken(c)) {
    await next();
    return;
  }

  const ip = resolveClientIp(c);
  const key = rateLimitKey(["ip", "public", ip]);
  const limited = await enforceLimit(c, key, { limit: 100, windowMs: ONE_MINUTE_MS });
  if (limited) return limited;

  await next();
}

/**
 * Field-team headroom: ~10 agents × heavy polling + 20+ calls/min bursts per agent.
 * Per-user (not per-IP) so office Wi‑Fi / carrier NAT is not a bottleneck.
 */
export const authenticatedUserRateLimit = createUserRateLimiter({
  limit: 6000,
  windowMs: ONE_MINUTE_MS,
  bucket: "global",
  methods: "all",
});

/** POST /api/leads */
export const leadsCreateRateLimit = createUserRateLimiter({
  limit: 300,
  windowMs: ONE_MINUTE_MS,
  bucket: "leads:post",
});

/** PATCH /api/leads/:id */
export const leadsPatchRateLimit = createUserRateLimiter({
  limit: 300,
  windowMs: ONE_MINUTE_MS,
  bucket: "leads:patch",
});

/** POST /api/calls/log — supports 200+ calls/session without throttling agents. */
export const callsLogRateLimit = createUserRateLimiter({
  limit: 600,
  windowMs: ONE_MINUTE_MS,
  bucket: "calls:log",
});

/** Generic write limiter for other mutating routes (projects, users, etc.). */
export const writeRateLimit = createUserRateLimiter({
  limit: 300,
  windowMs: ONE_MINUTE_MS,
  bucket: "write",
});

/** Lighter IP limit on login attempts (in addition to global public IP limit). */
export const loginRateLimit = createIpRateLimiter({
  limit: 20,
  windowMs: ONE_MINUTE_MS,
  bucket: "auth:login",
  methods: "all",
});

export const metaWebhookRateLimit = createIpRateLimiter({
  limit: 120,
  windowMs: ONE_MINUTE_MS,
  bucket: "meta-webhook",
  methods: "all",
});

/** 20 uploads/minute per user — POST /api/documents/upload */
export const documentUploadRateLimit = createUserRateLimiter({
  limit: 20,
  windowMs: ONE_MINUTE_MS,
  bucket: "documents:upload",
});

/** 60 requests/minute per portal webhook token. */
export function createPortalTokenRateLimiter(getToken: (c: Context) => string | undefined) {
  return async (c: Context, next: Next) => {
    const token = getToken(c);
    if (!token) {
      await next();
      return;
    }

    const key = rateLimitKey(["portal-token", token]);
    const limited = await enforceLimit(c, key, { limit: 60, windowMs: ONE_MINUTE_MS });
    if (limited) return limited;

    await next();
  };
}
