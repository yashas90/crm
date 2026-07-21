import { randomUUID } from "node:crypto";
import type { Context, Next } from "hono";
import { logger } from "../lib/logger.js";

/** Log a dedicated slow-request warning at/above this threshold. */
export const SLOW_REQUEST_MS = 1_500;

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

const PII_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "token",
  "phone",
  "email",
  "authorization",
]);

function scrubMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      out[key] = "[redacted]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

export const requestContextMiddleware = async (c: Context, next: Next) => {
  const requestId = c.req.header("x-request-id") ?? randomUUID();
  c.set("requestId", requestId);
  const start = Date.now();
  const isMetaWebhookProbe =
    c.req.method === "HEAD" && c.req.path === "/api/integrations/meta/webhook";

  if (!isMetaWebhookProbe) {
    logger.info(
      "request.start",
      scrubMeta({
        requestId,
        method: c.req.method,
        path: c.req.path,
      }),
    );
  }

  await next();

  const authUser = c.get("authUser") as { id?: string; orgId?: string } | undefined;
  const durationMs = Date.now() - start;

  if (!isMetaWebhookProbe) {
    const endMeta = scrubMeta({
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
      userId: authUser?.id,
      orgId: authUser?.orgId,
    });

    logger.info("request.end", endMeta);

    if (durationMs >= SLOW_REQUEST_MS) {
      logger.warn("request.slow", endMeta);
    }
  }
};
