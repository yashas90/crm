import { logger } from "../lib/logger.js";
import { slaService } from "../services/slaService.js";

const INTERVAL_MS = 15 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncSlaBreachFlags() {
  const result = await slaService.syncBreachedFlags();
  if (result.flagged > 0 || result.cleared > 0) {
    logger.info("SLA breach flags synced", result);
  }
  return result;
}

export function startSlaBreachJob() {
  if (syncTimer || process.env.VITEST === "true") return;

  logger.info("Starting SLA breach sync scheduler", { intervalMs: INTERVAL_MS });

  void syncSlaBreachFlags().catch((err) => {
    logger.warn("SLA breach sync failed on startup", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  syncTimer = setInterval(() => {
    void syncSlaBreachFlags().catch((err) => {
      logger.warn("SLA breach sync failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, INTERVAL_MS);
}

export function stopSlaBreachJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
