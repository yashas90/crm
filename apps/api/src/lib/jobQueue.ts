import { type ConnectionOptions, Queue, Worker } from "bullmq";
import { syncDailyFollowUpJobs } from "../jobs/dailyFollowUpJob.js";
import { syncFollowupReminders } from "../jobs/followUpReminderJob.js";
import { syncLeadScores } from "../jobs/leadScoringJob.js";
import { syncNaPoolUnassignments } from "../jobs/naPoolJob.js";
import { syncSiteVisitReminders } from "../jobs/siteVisitReminderJob.js";
import { purgeExpiredRefreshSessions } from "../services/refreshTokenService.js";
import { db } from "./db.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { isRedisEnabled } from "./redis.js";

export const JOB_QUEUE_NAME = "propninja-jobs";

export const JOB_NAMES = {
  LEAD_SCORING: "lead-scoring",
  FOLLOWUP_REMINDERS: "followup-reminders",
  SITE_VISIT_REMINDERS: "site-visit-reminders",
  DAILY_FOLLOWUP: "daily-followup",
  REFRESH_SESSION_CLEANUP: "refresh-session-cleanup",
  NA_POOL_RELEASE: "na-pool-release",
} as const;

let queue: Queue | null = null;
let worker: Worker | null = null;

function connectionOptions(): ConnectionOptions {
  return { url: env.REDIS_URL! };
}

async function runJob(name: string) {
  switch (name) {
    case JOB_NAMES.LEAD_SCORING:
      return syncLeadScores();
    case JOB_NAMES.FOLLOWUP_REMINDERS:
      return syncFollowupReminders();
    case JOB_NAMES.SITE_VISIT_REMINDERS:
      return syncSiteVisitReminders();
    case JOB_NAMES.DAILY_FOLLOWUP:
      return syncDailyFollowUpJobs();
    case JOB_NAMES.REFRESH_SESSION_CLEANUP:
      return purgeExpiredRefreshSessions(db);
    case JOB_NAMES.NA_POOL_RELEASE:
      return syncNaPoolUnassignments();
    default:
      logger.warn("Unknown durable job", { name });
  }
}

export function isDurableJobsEnabled(): boolean {
  return isRedisEnabled();
}

/** Register BullMQ repeatable jobs and worker (requires REDIS_URL). */
export async function startDurableJobQueue(): Promise<boolean> {
  if (!isRedisEnabled() || process.env.VITEST === "true" || queue) {
    return false;
  }

  queue = new Queue(JOB_QUEUE_NAME, { connection: connectionOptions() });

  await queue.add(
    JOB_NAMES.LEAD_SCORING,
    {},
    { repeat: { every: 6 * 60 * 60 * 1000 }, jobId: JOB_NAMES.LEAD_SCORING },
  );
  await queue.add(
    JOB_NAMES.FOLLOWUP_REMINDERS,
    {},
    { repeat: { every: 60 * 60 * 1000 }, jobId: JOB_NAMES.FOLLOWUP_REMINDERS },
  );
  await queue.add(
    JOB_NAMES.SITE_VISIT_REMINDERS,
    {},
    { repeat: { every: 5 * 60 * 1000 }, jobId: JOB_NAMES.SITE_VISIT_REMINDERS },
  );
  await queue.add(
    JOB_NAMES.DAILY_FOLLOWUP,
    {},
    { repeat: { every: 15 * 60 * 1000 }, jobId: JOB_NAMES.DAILY_FOLLOWUP },
  );
  await queue.add(
    JOB_NAMES.REFRESH_SESSION_CLEANUP,
    {},
    { repeat: { every: 6 * 60 * 60 * 1000 }, jobId: JOB_NAMES.REFRESH_SESSION_CLEANUP },
  );
  await queue.add(
    JOB_NAMES.NA_POOL_RELEASE,
    {},
    { repeat: { every: 30 * 1000 }, jobId: JOB_NAMES.NA_POOL_RELEASE },
  );

  worker = new Worker(
    JOB_QUEUE_NAME,
    async (job: { name: string }) => {
      await runJob(job.name);
    },
    { connection: connectionOptions() },
  );

  worker.on("failed", (job: { name?: string } | undefined, error: Error) => {
    logger.error("Durable job failed", {
      name: job?.name,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  logger.info("BullMQ durable job queue started", { queue: JOB_QUEUE_NAME });
  return true;
}

export async function stopDurableJobQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}
