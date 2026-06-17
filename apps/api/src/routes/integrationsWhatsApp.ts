/**
 * WhatsApp Business API webhook for delivery/read status updates.
 */
import { Hono } from "hono";
import { env } from "../lib/env.js";
import { verifyMetaWebhookSignature } from "../lib/facebook.js";
import { logger } from "../lib/logger.js";
import { extractWhatsAppStatusUpdates, whatsAppVerifyToken } from "../lib/whatsapp.js";
import { metaWebhookRateLimit } from "../middleware/rateLimit.js";
import { whatsappService } from "../services/whatsappService.js";

export const whatsappIntegrationsRoute = new Hono();

whatsappIntegrationsRoute.get("/webhook", (c) => {
  const mode = c.req.query("hub.mode");
  const verifyToken = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && verifyToken === whatsAppVerifyToken() && challenge) {
    return c.text(challenge, 200);
  }

  return c.text("Forbidden", 403);
});

whatsappIntegrationsRoute.post("/webhook", metaWebhookRateLimit, async (c) => {
  const rawBody = await c.req.text();
  const appSecret = env.META_APP_SECRET?.trim();
  const signature = c.req.header("x-hub-signature-256");
  const requireSignature = env.NODE_ENV === "production";

  if (requireSignature) {
    if (!appSecret || !verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
      logger.warn("WhatsApp webhook rejected: invalid or missing X-Hub-Signature-256");
      return c.text("Forbidden", 403);
    }
  } else if (appSecret) {
    if (!verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
      logger.warn("WhatsApp webhook rejected: invalid or missing X-Hub-Signature-256");
      return c.text("Forbidden", 403);
    }
  } else {
    logger.warn("WhatsApp webhook accepted without signature verification (development only)");
  }

  let body: Parameters<typeof extractWhatsAppStatusUpdates>[0];

  try {
    body = JSON.parse(rawBody);
  } catch (error) {
    logger.warn("WhatsApp webhook received invalid JSON", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.text("EVENT_RECEIVED", 200);
  }

  const updates = extractWhatsAppStatusUpdates(body);

  if (updates.length > 0) {
    void whatsappService.applyStatusUpdates(updates).catch((error) => {
      logger.error("WhatsApp status update failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return c.text("EVENT_RECEIVED", 200);
});
