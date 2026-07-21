import { db } from "../lib/db.js";
import { clearAllIpBlocks, clearExpiredIpBlocks } from "../lib/ipBlocklist.js";
import { startDurableJobQueue } from "../lib/jobQueue.js";
import { logger } from "../lib/logger.js";
import { clearAllLoginRateLimits } from "../lib/loginBruteForce.js";
import { clearAllRateLimits, pruneExpiredRateLimitBuckets } from "../lib/rateLimitStore.js";
import { pruneSecurityWindows } from "../middleware/securityMonitoring.js";
import { syncPagesFormsAndSubscribe } from "../services/metaPageSyncService.js";
import { purgeExpiredRefreshSessions } from "../services/refreshTokenService.js";
import { startDailyFollowUpJobs } from "./dailyFollowUpJob.js";
import { startFollowupReminderJob } from "./followUpReminderJob.js";
import { startLeadScoringJob } from "./leadScoringJob.js";
import { startNaPoolJob } from "./naPoolJob.js";
import { startSiteVisitReminderJob } from "./siteVisitReminderJob.js";
import { startSlaBreachJob } from "./slaBreachJob.js";

/** Use BullMQ when Redis is configured; otherwise fall back to in-process timers. */
export async function startBackgroundJobs() {
  const clearedBlocks = await clearAllIpBlocks();
  if (clearedBlocks > 0) {
    logger.info("Cleared stale IP blocks on startup", { clearedBlocks });
  }

  const clearedRateLimits = clearAllRateLimits();
  const clearedLoginLimits = clearAllLoginRateLimits();
  if (clearedRateLimits > 0 || clearedLoginLimits > 0) {
    logger.info("Cleared stale rate-limit counters on startup", {
      clearedRateLimits,
      clearedLoginLimits,
    });
  }

  const durable = await startDurableJobQueue();
  if (durable) {
    logger.info("Background jobs running via BullMQ + Redis");
    return;
  }

  startFollowupReminderJob();
  startSiteVisitReminderJob();
  startLeadScoringJob();
  startDailyFollowUpJobs();
  startNaPoolJob();
  startSlaBreachJob();
  setInterval(
    () => {
      void syncPagesFormsAndSubscribe().catch((err) => {
        logger.warn("In-process Meta asset sync failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      });
    },
    6 * 60 * 60 * 1000,
  ).unref();
  setInterval(
    () => {
      void purgeExpiredRefreshSessions(db).catch((err) => {
        logger.warn("Refresh session cleanup failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      });
    },
    6 * 60 * 60 * 1000,
  );

  // Prune in-memory Maps every 15 minutes to prevent OOM crashes
  const PRUNE_INTERVAL = 15 * 60 * 1000;
  setInterval(() => {
    pruneSecurityWindows();
    pruneExpiredRateLimitBuckets();
    clearExpiredIpBlocks();
  }, PRUNE_INTERVAL).unref();
}
