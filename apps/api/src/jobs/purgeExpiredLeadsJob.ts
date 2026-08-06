import { logger } from "../lib/logger.js";
import { purgeExpiredLeads } from "../lib/purgeExpiredLeads.js";

const INTERVAL_MS = 15 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncPurgeExpiredLeads() {
  return purgeExpiredLeads();
}

export function startPurgeExpiredLeadsJob() {
  if (syncTimer || process.env.VITEST === "true") return;

  logger.info("Starting expired lead purge scheduler", {
    intervalMs: INTERVAL_MS,
    retentionHours: 48,
  });

  void syncPurgeExpiredLeads().catch((err) => {
    logger.warn("Expired lead purge failed on startup", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  syncTimer = setInterval(() => {
    void syncPurgeExpiredLeads().catch((err) => {
      logger.warn("Expired lead purge failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, INTERVAL_MS);
  syncTimer.unref?.();
}

export function stopPurgeExpiredLeadsJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
