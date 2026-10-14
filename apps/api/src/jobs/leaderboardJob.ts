import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { createLeaderboardService } from "../services/leaderboardService.js";

export function startLeaderboardJob() {
  const run = () => {
    void createLeaderboardService(db)
      .runDaily(new Date())
      .catch((err) => {
        logger.warn("Leaderboard snapshot and month-end job failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      });
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}
