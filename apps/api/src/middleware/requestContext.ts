import { randomUUID } from "node:crypto";
import type { Context, Next } from "hono";
import { logger } from "../lib/logger.js";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

export const requestContextMiddleware = async (c: Context, next: Next) => {
  const requestId = c.req.header("x-request-id") ?? randomUUID();
  c.set("requestId", requestId);
  const start = Date.now();

  logger.info("request.start", {
    requestId,
    method: c.req.method,
    path: c.req.path,
  });

  await next();

  const authUser = c.get("authUser") as { id?: string; orgId?: string } | undefined;

  logger.info("request.end", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
    userId: authUser?.id,
    orgId: authUser?.orgId,
  });
};
