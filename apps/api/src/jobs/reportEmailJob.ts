import { getIstDateKey, isIstDailyWindow, isIstMonday } from "../lib/istSchedule.js";
import { logger } from "../lib/logger.js";
import { sendDailyReportEmails, sendWeeklyReportEmails } from "../services/reportEmailService.js";

const INTERVAL_MS = 15 * 60 * 1000;
const IST_REPORT_HOUR = 8;

let syncTimer: ReturnType<typeof setInterval> | undefined;
let lastDailyRunDate: string | null = null;
let lastWeeklyRunDate: string | null = null;

export async function syncDailyReportEmails(now = new Date()) {
  const istDate = getIstDateKey(now);
  if (!isIstDailyWindow(IST_REPORT_HOUR, 15, now)) {
    return { skipped: true, reason: "outside_window" as const };
  }
  if (lastDailyRunDate === istDate) {
    return { skipped: true, reason: "already_ran" as const };
  }

  const result = await sendDailyReportEmails(undefined, now);
  lastDailyRunDate = istDate;
  logger.info("Daily report emails job finished", result);
  return result;
}

export async function syncWeeklyReportEmails(now = new Date()) {
  const istDate = getIstDateKey(now);
  if (!isIstMonday(now)) {
    return { skipped: true, reason: "not_monday" as const };
  }
  if (!isIstDailyWindow(IST_REPORT_HOUR, 15, now)) {
    return { skipped: true, reason: "outside_window" as const };
  }
  if (lastWeeklyRunDate === istDate) {
    return { skipped: true, reason: "already_ran" as const };
  }

  const result = await sendWeeklyReportEmails(undefined, now);
  lastWeeklyRunDate = istDate;
  logger.info("Weekly report emails job finished", result);
  return result;
}

export async function syncReportEmailJobs(now = new Date()) {
  const daily = await syncDailyReportEmails(now);
  const weekly = await syncWeeklyReportEmails(now);
  return { daily, weekly };
}

export function startReportEmailJob() {
  if (syncTimer || process.env.VITEST === "true") {
    return;
  }

  logger.info("Starting report email jobs (daily + weekly)", { intervalMs: INTERVAL_MS });

  syncTimer = setInterval(() => {
    void syncReportEmailJobs().catch((error) => {
      logger.error("Report email job failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, INTERVAL_MS);

  if (typeof syncTimer === "object" && "unref" in syncTimer) {
    syncTimer.unref();
  }
}

export function stopReportEmailJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
  lastDailyRunDate = null;
  lastWeeklyRunDate = null;
}

export function resetReportEmailJobState() {
  lastDailyRunDate = null;
  lastWeeklyRunDate = null;
}
