/**
 * Meta Lead Ads webhook ingress.
 * In production, META_APP_SECRET must be set and X-Hub-Signature-256 must validate;
 * otherwise POST webhooks are rejected.
 *
 * Flow: verify signature → acknowledge EVENT_RECEIVED → (BullMQ when Redis available,
 * else in-process) fetch Graph lead → CRM ingest via adLeadService.
 */
import { Hono } from "hono";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { env } from "../lib/env.js";
import {
  type MetaLeadgenWebhookBody,
  enrichFacebookAdLeadMetadata,
  extractLeadgenChanges,
  getLeadDetails,
  mapFacebookLeadToNormalizedAdLead,
  verifyMetaWebhookSignature,
} from "../lib/facebook.js";
import { enqueueMetaLeadIngest, isDurableJobsEnabled } from "../lib/jobQueue.js";
import { logger } from "../lib/logger.js";
import { isMetaLeadgenAllowed } from "../lib/metaWebhookScope.js";
import { metaWebhookRateLimit } from "../middleware/rateLimit.js";
import { adLeadService } from "../services/adLeadService.js";
import { processLeadgenWebhook, recordWebhookDedupe } from "../services/metaLeadIngestService.js";

export const metaIntegrationsRoute = new Hono();

metaIntegrationsRoute.get("/webhook", (c) => {
  const mode = c.req.query("hub.mode");
  const verifyToken = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && verifyToken === env.META_VERIFY_TOKEN && challenge) {
    return c.text(challenge, 200);
  }

  return c.text("Forbidden", 403);
});

/** Meta/Facebook periodically probes the webhook with HEAD — respond OK to avoid retry storms. */
metaIntegrationsRoute.on("HEAD", "/webhook", (c) => c.body(null, 200));

/** Legacy env-token path used when BullMQ is unavailable or DB page tokens are missing. */
async function processMetaLeadWebhookLegacy(body: MetaLeadgenWebhookBody) {
  const leadgenChanges = extractLeadgenChanges(body);

  if (leadgenChanges.length === 0) {
    logger.debug("Meta webhook received with no leadgen changes");
    return;
  }

  for (const change of leadgenChanges) {
    const scopeCheck = isMetaLeadgenAllowed(change);
    if (!scopeCheck.allowed) {
      logger.info("Meta lead skipped by webhook scope", {
        leadgenId: change.leadgen_id,
        pageId: change.page_id,
        formId: change.form_id,
        reason: scopeCheck.reason,
      });
      continue;
    }

    try {
      const leadDetails = await getLeadDetails(change.leadgen_id);
      const mapped = mapFacebookLeadToNormalizedAdLead(change.leadgen_id, leadDetails, change);
      const normalized = await enrichFacebookAdLeadMetadata(mapped);
      const lead = await adLeadService.ingestAdLead(normalized);

      logger.info("Meta lead ingested", {
        leadgenId: change.leadgen_id,
        leadId: lead.id,
        pageId: change.page_id,
      });
    } catch (error) {
      logger.error("Failed to ingest Meta lead", {
        leadgenId: change.leadgen_id,
        pageId: change.page_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function processMetaLeadWebhook(body: MetaLeadgenWebhookBody) {
  const leadgenChanges = extractLeadgenChanges(body);

  if (leadgenChanges.length === 0) {
    logger.debug("Meta webhook received with no leadgen changes");
    return;
  }

  const durable = isDurableJobsEnabled();

  for (const change of leadgenChanges) {
    const scopeCheck = isMetaLeadgenAllowed(change);
    if (!scopeCheck.allowed) {
      logger.info("Meta lead skipped by webhook scope", {
        leadgenId: change.leadgen_id,
        pageId: change.page_id,
        formId: change.form_id,
        reason: scopeCheck.reason,
      });
      continue;
    }

    try {
      const dedupe = await recordWebhookDedupe(change, SINGLE_TENANT_ORG_ID);
      if (dedupe.alreadyProcessed) {
        logger.info("Meta leadgen duplicate delivery skipped", {
          leadgenId: change.leadgen_id,
        });
        continue;
      }

      if (durable) {
        const enqueued = await enqueueMetaLeadIngest({
          change,
          orgId: SINGLE_TENANT_ORG_ID,
          webhookId: dedupe.webhookId,
        });
        if (enqueued) {
          logger.info("Meta leadgen queued for durable ingest", {
            leadgenId: change.leadgen_id,
            webhookId: dedupe.webhookId,
          });
          continue;
        }
      }

      await processLeadgenWebhook(change, {
        orgId: SINGLE_TENANT_ORG_ID,
        webhookId: dedupe.webhookId ?? undefined,
      });
    } catch (error) {
      logger.error("DB-driven Meta ingest failed; falling back to legacy path", {
        leadgenId: change.leadgen_id,
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        const leadDetails = await getLeadDetails(change.leadgen_id);
        const mapped = mapFacebookLeadToNormalizedAdLead(change.leadgen_id, leadDetails, change);
        const normalized = await enrichFacebookAdLeadMetadata(mapped);
        await adLeadService.ingestAdLead(normalized);
      } catch (legacyError) {
        logger.error("Failed to ingest Meta lead (legacy fallback)", {
          leadgenId: change.leadgen_id,
          pageId: change.page_id,
          error: legacyError instanceof Error ? legacyError.message : String(legacyError),
        });
      }
    }
  }
}

metaIntegrationsRoute.post("/webhook", metaWebhookRateLimit, async (c) => {
  const rawBody = await c.req.text();
  const appSecret = env.META_APP_SECRET?.trim();
  const signature = c.req.header("x-hub-signature-256");
  const requireSignature = env.NODE_ENV === "production";

  if (requireSignature) {
    if (!appSecret || !verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
      logger.warn("Meta webhook rejected: invalid or missing X-Hub-Signature-256");
      return c.text("Forbidden", 403);
    }
  } else if (appSecret) {
    if (!verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
      logger.warn("Meta webhook rejected: invalid or missing X-Hub-Signature-256");
      return c.text("Forbidden", 403);
    }
  } else {
    logger.warn("Meta webhook accepted without signature verification (development only)");
  }

  let body: MetaLeadgenWebhookBody;

  try {
    body = JSON.parse(rawBody) as MetaLeadgenWebhookBody;
  } catch (error) {
    logger.warn("Meta webhook received invalid JSON", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.text("EVENT_RECEIVED", 200);
  }

  // Acknowledge immediately; Graph API + CRM ingest runs in the background.
  void processMetaLeadWebhook(body).catch((error) => {
    logger.error("Meta webhook processing failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Last-resort legacy path if the outer handler itself throws before per-lead try/catch.
    void processMetaLeadWebhookLegacy(body).catch(() => undefined);
  });

  return c.text("EVENT_RECEIVED", 200);
});
