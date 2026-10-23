/**
 * Always-on Meta Lead Ads intake.
 *
 * Webhooks are real-time, but Meta only delivers them while the Page `leadgen`
 * subscription stays attached — and a failed ingest used to sit until a later
 * form scan happened to list that lead again.
 *
 * This loop runs inside the API process either way:
 *  - every 30 seconds, re-pull leads whose ingest failed or got stuck
 *  - every minute, pull recent leads from Graph
 *  - every 10 minutes, re-subscribe selected Pages and do a deeper catch-up
 * A pull that is still running does not drop the next one; it starts as soon
 * as the current scan finishes.
 */
import { logger } from "../lib/logger.js";
import { retryFailedMetaLeads } from "../services/metaFailedLeadRetry.js";
import { backfillMetaLeads } from "../services/metaLeadBackfillService.js";
import { subscribeSelectedPagesToLeadgen } from "../services/metaPageSyncService.js";

/** Must stay well under META_POLL_HEALTHY_MS (8 minutes) so one slow scan is not "offline". */
export const META_LEAD_PULL_INTERVAL_MS = 60 * 1000;
export const META_FAILED_LEAD_RETRY_INTERVAL_MS = 30 * 1000;
export const META_LEAD_SUBSCRIBE_INTERVAL_MS = 10 * 60 * 1000;

type PullMode = "startup" | "fast" | "deep";

const PULL_RANK: Record<PullMode, number> = { fast: 0, deep: 1, startup: 2 };

let pullTimer: ReturnType<typeof setInterval> | undefined;
let retryTimer: ReturnType<typeof setInterval> | undefined;
let subscribeTimer: ReturnType<typeof setInterval> | undefined;
let pullInFlight = false;
let subscribeInFlight = false;
let queuedMode: PullMode | null = null;

function preferMode(current: PullMode, incoming: PullMode): PullMode {
  return PULL_RANK[incoming] > PULL_RANK[current] ? incoming : current;
}

async function pullRecentMetaLeads(mode: PullMode) {
  if (pullInFlight) {
    queuedMode = queuedMode ? preferMode(queuedMode, mode) : mode;
    logger.info("Meta lead pull queued until the current scan finishes", {
      mode,
      queuedMode,
    });
    return;
  }

  pullInFlight = true;
  let followUp: PullMode | null = null;
  try {
    await retryFailedMetaLeads(undefined, { thorough: mode !== "fast" });

    const options =
      mode === "fast"
        ? {
            sinceDays: 2,
            includeUnselected: true,
            discoverFormsFromGraph: false,
            maxPages: 20,
            syncType: "leads_continuity" as const,
          }
        : {
            sinceDays: mode === "startup" ? 7 : 3,
            includeUnselected: true,
            discoverFormsFromGraph: true,
            maxPages: mode === "startup" ? 50 : 40,
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
    followUp = queuedMode;
    queuedMode = null;
  }

  if (followUp) void pullRecentMetaLeads(followUp);
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
    retryIntervalMs: META_FAILED_LEAD_RETRY_INTERVAL_MS,
    subscribeIntervalMs: META_LEAD_SUBSCRIBE_INTERVAL_MS,
  });

  void pullRecentMetaLeads("startup");
  void renewLeadgenSubscriptions();

  retryTimer = setInterval(() => {
    void retryFailedMetaLeads();
  }, META_FAILED_LEAD_RETRY_INTERVAL_MS);
  retryTimer.unref?.();

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
  if (retryTimer) clearInterval(retryTimer);
  if (subscribeTimer) clearInterval(subscribeTimer);
  pullTimer = undefined;
  retryTimer = undefined;
  subscribeTimer = undefined;
  pullInFlight = false;
  subscribeInFlight = false;
  queuedMode = null;
}
