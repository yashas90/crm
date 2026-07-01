import { db } from "../lib/db.js";
import { startDurableJobQueue } from "../lib/jobQueue.js";
import { logger } from "../lib/logger.js";
import { purgeExpiredRefreshSessions } from "../services/refreshTokenService.js";
import { startDailyFollowUpJobs } from "./dailyFollowUpJob.js";
import { startFollowupReminderJob } from "./followUpReminderJob.js";
import { startLeadScoringJob } from "./leadScoringJob.js";
import { startNaPoolJob } from "./naPoolJob.js";
import { startSiteVisitReminderJob } from "./siteVisitReminderJob.js";

/** Use BullMQ when Redis is configured; otherwise fall back to in-process timers. */
export async function startBackgroundJobs() {
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
}
