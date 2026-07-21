import { type ConnectionOptions, type JobsOptions, Queue, Worker } from "bullmq";
import { syncDailyFollowUpJobs } from "../jobs/dailyFollowUpJob.js";
import { syncFollowupReminders } from "../jobs/followUpReminderJob.js";
import { syncLeadScores } from "../jobs/leadScoringJob.js";
import { syncNaPoolUnassignments } from "../jobs/naPoolJob.js";
import { syncSiteVisitReminders } from "../jobs/siteVisitReminderJob.js";
import { sendPendingConversionEvents } from "../services/metaConversionService.js";
import {
  type MetaLeadIngestJobPayload,
  processLeadgenWebhook,
} from "../services/metaLeadIngestService.js";
import { syncPagesFormsAndSubscribe } from "../services/metaPageSyncService.js";
import { syncInsights } from "../services/metaSyncService.js";
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
  META_LEAD_INGEST: "meta-lead-ingest",
  META_CAPI_SEND: "meta-capi-send",
  META_INSIGHTS_SYNC: "meta-insights-sync",
  META_ASSET_SYNC: "meta-asset-sync",
} as const;

let queue: Queue | null = null;
let worker: Worker | null = null;

function connectionOptions(): ConnectionOptions {
  return { url: env.REDIS_URL! };
}

async function runJob(name: string, data?: Record<string, unknown>) {
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
    case JOB_NAMES.META_LEAD_INGEST: {
      const payload = data as unknown as MetaLeadIngestJobPayload | undefined;
      if (!payload?.change?.leadgen_id) {
        logger.warn("META_LEAD_INGEST job missing change payload");
        return;
      }
      return processLeadgenWebhook(payload.change, {
        orgId: payload.orgId,
        webhookId: payload.webhookId,
      });
    }
    case JOB_NAMES.META_CAPI_SEND:
      return sendPendingConversionEvents();
    case JOB_NAMES.META_INSIGHTS_SYNC:
      return syncInsights();
    case JOB_NAMES.META_ASSET_SYNC:
      return syncPagesFormsAndSubscribe().catch((error) => {
        logger.warn("Scheduled Meta asset sync failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
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

  try {
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
    await queue.add(
      JOB_NAMES.META_CAPI_SEND,
      {},
      { repeat: { every: 2 * 60 * 1000 }, jobId: JOB_NAMES.META_CAPI_SEND },
    );
    await queue.add(
      JOB_NAMES.META_INSIGHTS_SYNC,
      {},
      { repeat: { every: 6 * 60 * 60 * 1000 }, jobId: JOB_NAMES.META_INSIGHTS_SYNC },
    );
    await queue.add(
      JOB_NAMES.META_ASSET_SYNC,
      {},
      { repeat: { every: 6 * 60 * 60 * 1000 }, jobId: JOB_NAMES.META_ASSET_SYNC },
    );

    queue.on("error", (error: Error) => {
      logger.error("BullMQ queue error", { message: error.message });
    });

    worker = new Worker(
      JOB_QUEUE_NAME,
      async (job: { name: string; data?: Record<string, unknown> }) => {
        await runJob(job.name, job.data);
      },
      { connection: connectionOptions() },
    );

    worker.on("failed", (job: { name?: string } | undefined, error: Error) => {
      logger.error("Durable job failed", {
        name: job?.name,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Missing error handler = unhandled 'error' event = process crash
    worker.on("error", (error: Error) => {
      logger.error("BullMQ worker error", { message: error.message });
    });

    logger.info("BullMQ durable job queue started", { queue: JOB_QUEUE_NAME });
    return true;
  } catch (error) {
    await stopDurableJobQueue();
    logger.error("BullMQ startup failed; falling back to in-process schedulers", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function stopDurableJobQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}

const DEFAULT_META_LEAD_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
};

/** Enqueue a Meta leadgen ingest job. Returns false when Redis/BullMQ is unavailable. */
export async function enqueueMetaLeadIngest(
  payload: MetaLeadIngestJobPayload,
  opts?: JobsOptions,
): Promise<boolean> {
  if (!queue) return false;
  const jobId = `meta-lead-${payload.change.leadgen_id}`;
  await queue.add(JOB_NAMES.META_LEAD_INGEST, payload, {
    ...DEFAULT_META_LEAD_OPTS,
    jobId,
    ...opts,
  });
  return true;
}

/** Enqueue an immediate CAPI flush (also runs on a 2-minute schedule). */
export async function enqueueMetaCapiSend(opts?: JobsOptions): Promise<boolean> {
  if (!queue) return false;
  await queue.add(JOB_NAMES.META_CAPI_SEND, {}, { ...opts });
  return true;
}
