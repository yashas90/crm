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
