/**
 * WhatsApp Business API webhook for delivery/read status updates and inbound replies.
 * Mounted at:
 *   /api/integrations/whatsapp  → GET/POST /webhook
 *   /webhook/whatsapp           → GET/POST /
 */
import { Hono } from "hono";
import { env } from "../lib/env.js";
import { verifyMetaWebhookSignature } from "../lib/facebook.js";
import { logger } from "../lib/logger.js";
import {
  extractWhatsAppInboundMessages,
  extractWhatsAppStatusUpdates,
  whatsAppVerifyToken,
} from "../lib/whatsapp.js";
import { metaWebhookRateLimit } from "../middleware/rateLimit.js";
import { whatsappBlasterService } from "../services/whatsappBlasterService.js";
import { whatsappService } from "../services/whatsappService.js";

export const whatsappIntegrationsRoute = new Hono();

function handleVerify(c: {
  req: { query: (key: string) => string | undefined };
  text: (body: string, status: 200 | 403) => Response;
}) {
  const mode = c.req.query("hub.mode");
  const verifyToken = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && verifyToken === whatsAppVerifyToken() && challenge) {
    return c.text(challenge, 200);
  }

  return c.text("Forbidden", 403);
}

async function handleEvent(c: {
  req: { text: () => Promise<string>; header: (name: string) => string | undefined };
  text: (body: string, status: 200 | 403) => Response;
}) {
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
  const inbound = extractWhatsAppInboundMessages(body);

  if (updates.length > 0) {
    void whatsappService.applyStatusUpdates(updates).catch((error) => {
      logger.error("WhatsApp status update failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    void whatsappBlasterService.applyStatusUpdates(updates).catch((error) => {
      logger.error("WhatsApp blaster status update failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  if (inbound.length > 0) {
    void whatsappBlasterService.handleInbound(inbound).catch((error) => {
      logger.error("WhatsApp inbound handling failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return c.text("EVENT_RECEIVED", 200);
}

whatsappIntegrationsRoute.get("/webhook", (c) => handleVerify(c));
whatsappIntegrationsRoute.get("/", (c) => handleVerify(c));
whatsappIntegrationsRoute.post("/webhook", metaWebhookRateLimit, (c) => handleEvent(c));
whatsappIntegrationsRoute.post("/", metaWebhookRateLimit, (c) => handleEvent(c));
