import { ageOutStaleNewLeads } from "../lib/ageOutNewLeads.js";
import { logger } from "../lib/logger.js";

const INTERVAL_MS = 5 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncAgeOutNewLeads() {
  return ageOutStaleNewLeads();
}

export function startAgeOutNewLeadsJob() {
  if (syncTimer || process.env.VITEST === "true") return;

  logger.info("Starting new-lead age-out scheduler", { intervalMs: INTERVAL_MS });

  void syncAgeOutNewLeads().catch((err) => {
    logger.warn("New-lead age-out failed on startup", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  syncTimer = setInterval(() => {
    void syncAgeOutNewLeads().catch((err) => {
      logger.warn("New-lead age-out failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, INTERVAL_MS);
  syncTimer.unref?.();
}

export function stopAgeOutNewLeadsJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
