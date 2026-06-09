import type { Context, Next } from "hono";
import { jsonError } from "../lib/response.js";
import type { AuthUser } from "../middleware/auth.js";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function createRateLimiter(options: { limit: number; windowMs: number }) {
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

    const key = authUser.id;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > options.limit) {
      return jsonError(
        c,
        "RATE_LIMITED",
        "Too many requests. Please slow down and try again.",
        429,
      );
    }

    await next();
  };
}

export const writeRateLimit = createRateLimiter({ limit: 60, windowMs: 60_000 });

function resolveClientIp(c: Context) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("x-real-ip")?.trim() || "unknown";
}

/** IP-based limiter for unauthenticated public endpoints (e.g. Meta webhooks). */
export function createIpRateLimiter(options: {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
}) {
  return async (c: Context, next: Next) => {
    const ip = resolveClientIp(c);
    const key = `${options.keyPrefix ?? "ip"}:${ip}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > options.limit) {
      return jsonError(
        c,
        "RATE_LIMITED",
        "Too many requests. Please slow down and try again.",
        429,
      );
    }

    await next();
  };
}

export const metaWebhookRateLimit = createIpRateLimiter({
  limit: 120,
  windowMs: 60_000,
  keyPrefix: "meta-webhook",
});
