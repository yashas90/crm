import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { createPortalTokenRateLimiter } from "../middleware/rateLimit.js";
import { portalWebhookService } from "../services/portalWebhookService.js";

export const portalIntegrationsRoute = new Hono();

const portalTokenRateLimit = createPortalTokenRateLimiter((c) => c.req.param("token"));

function resolveClientIp(c: { req: { header: (name: string) => string | undefined } }) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("x-real-ip")?.trim() || null;
}

portalIntegrationsRoute.post("/:token", portalTokenRateLimit, async (c) => {
  const token = c.req.param("token");
  if (!token) {
    return jsonError(c, "FORBIDDEN", "Invalid webhook token", 403);
  }

  try {
    const webhook = await portalWebhookService.getByToken(token);
    if (!webhook) {
      return jsonError(c, "FORBIDDEN", "Invalid webhook token", 403);
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return jsonError(c, "BAD_REQUEST", "Invalid JSON body", 400);
    }

    const result = await portalWebhookService.ingestFromWebhook(webhook, payload, {
      ipAddress: resolveClientIp(c),
    });

    return jsonOk(c, { received: result.received });
  } catch (error) {
    if (error instanceof AppError) {
      return jsonError(
        c,
        error.code,
        error.message,
        error.status as ContentfulStatusCode,
        error.details,
      );
    }

    logger.error("Portal webhook ingest failed", {
      token,
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError(c, "INTERNAL_ERROR", "Failed to process webhook", 500);
  }
});
