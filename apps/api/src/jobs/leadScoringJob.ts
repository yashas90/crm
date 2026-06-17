import { logger } from "../lib/logger.js";
import { recalculateAllActiveLeadScores } from "../services/leadScoringService.js";

const INTERVAL_MS = 6 * 60 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncLeadScores(now = new Date()) {
  const result = await recalculateAllActiveLeadScores(now);

  if (!result.skipped && result.updated > 0) {
    logger.info("Lead scores recalculated", {
      updated: result.updated,
      checked: result.checked,
    });
  }

  return result;
}

export function startLeadScoringJob() {
  if (syncTimer || process.env.VITEST === "true") {
    return;
  }

  logger.info("Starting lead scoring scheduler (every 6 hours)", { intervalMs: INTERVAL_MS });

  void syncLeadScores().catch((error) => {
    logger.error("Initial lead scoring sync failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  syncTimer = setInterval(() => {
    void syncLeadScores().catch((error) => {
      logger.error("Scheduled lead scoring sync failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, INTERVAL_MS);

  if (typeof syncTimer === "object" && "unref" in syncTimer) {
    syncTimer.unref();
  }
}

export function stopLeadScoringJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
