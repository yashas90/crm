import { logger } from "../lib/logger.js";
import { purgeExpiredTrackingData } from "../lib/purgeExpiredTracking.js";
import { getTrackingConfig } from "../lib/trackingConfig.js";

/** Daily-ish interval; BullMQ also registers a cron when Redis is available. */
const INTERVAL_MS = 24 * 60 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncPurgeExpiredTracking() {
  return purgeExpiredTrackingData();
}

export function startPurgeExpiredTrackingJob() {
  if (syncTimer || process.env.VITEST === "true") return;

  const { retentionDays } = getTrackingConfig();
  logger.info("Starting tracking retention cleanup scheduler", {
    intervalMs: INTERVAL_MS,
    retentionDays,
  });

  void syncPurgeExpiredTracking().catch((err) => {
    logger.warn("Tracking retention cleanup failed on startup", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  syncTimer = setInterval(() => {
    void syncPurgeExpiredTracking().catch((err) => {
      logger.warn("Tracking retention cleanup failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, INTERVAL_MS);
  syncTimer.unref?.();
}

export function stopPurgeExpiredTrackingJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
