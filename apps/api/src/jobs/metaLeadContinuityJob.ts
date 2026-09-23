/**
 * Always-on Meta Lead Ads intake.
 *
 * Webhooks are real-time, but Meta only delivers them while the Page `leadgen`
 * subscription stays attached — and the Settings badge treats any quiet hour
 * as "Webhook Offline". The BullMQ backup also stops when Redis stalls,
 * because that path returns before the in-process timer is registered.
 *
 * This loop runs inside the API process either way:
 *  - every 2 minutes, pull recent leads from Graph
 *  - every 10 minutes, re-subscribe selected Pages and do a deeper catch-up
 */
import { logger } from "../lib/logger.js";
import { backfillMetaLeads } from "../services/metaLeadBackfillService.js";
import { subscribeSelectedPagesToLeadgen } from "../services/metaPageSyncService.js";

/** Must stay well under META_POLL_HEALTHY_MS (8 minutes) so one slow scan is not "offline". */
export const META_LEAD_PULL_INTERVAL_MS = 2 * 60 * 1000;
export const META_LEAD_SUBSCRIBE_INTERVAL_MS = 10 * 60 * 1000;

type PullMode = "startup" | "fast" | "deep";

let pullTimer: ReturnType<typeof setInterval> | undefined;
let subscribeTimer: ReturnType<typeof setInterval> | undefined;
let pullInFlight = false;
let subscribeInFlight = false;

async function pullRecentMetaLeads(mode: PullMode) {
  if (pullInFlight) {
    logger.info("Meta lead pull skipped — previous pull still running", { mode });
    return;
  }

  pullInFlight = true;
  try {
    const options =
      mode === "fast"
        ? {
            sinceDays: 1,
            includeUnselected: true,
            discoverFormsFromGraph: false,
            maxPages: 5,
            syncType: "leads_continuity" as const,
          }
        : {
            sinceDays: mode === "startup" ? 7 : 2,
            includeUnselected: true,
            discoverFormsFromGraph: true,
            maxPages: mode === "startup" ? 20 : 10,
            syncType: "leads_continuity" as const,
          };

    await backfillMetaLeads(undefined, options);
  } catch (error) {
    logger.warn("Continuous Meta lead pull failed", {
      mode,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    pullInFlight = false;
  }
}

async function renewLeadgenSubscriptions() {
  if (subscribeInFlight) return;
  subscribeInFlight = true;
  try {
    const result = await subscribeSelectedPagesToLeadgen();
    logger.info("Renewed Meta leadgen page subscriptions", result);
  } catch (error) {
    logger.warn("Meta leadgen resubscribe failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    subscribeInFlight = false;
  }
}

export function startMetaLeadContinuity() {
  if (pullTimer || process.env.VITEST === "true") return;

  logger.info("Starting continuous Meta lead intake", {
    pullIntervalMs: META_LEAD_PULL_INTERVAL_MS,
    subscribeIntervalMs: META_LEAD_SUBSCRIBE_INTERVAL_MS,
  });

  void pullRecentMetaLeads("startup");
  void renewLeadgenSubscriptions();

  pullTimer = setInterval(() => {
    void pullRecentMetaLeads("fast");
  }, META_LEAD_PULL_INTERVAL_MS);
  pullTimer.unref?.();

  subscribeTimer = setInterval(() => {
    void renewLeadgenSubscriptions();
    void pullRecentMetaLeads("deep");
  }, META_LEAD_SUBSCRIBE_INTERVAL_MS);
  subscribeTimer.unref?.();
}

export function stopMetaLeadContinuity() {
  if (pullTimer) clearInterval(pullTimer);
  if (subscribeTimer) clearInterval(subscribeTimer);
  pullTimer = undefined;
  subscribeTimer = undefined;
  pullInFlight = false;
  subscribeInFlight = false;
}
