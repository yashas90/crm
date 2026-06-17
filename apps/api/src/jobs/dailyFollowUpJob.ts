import { users } from "@propninja/db";
import { and, eq, inArray } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { getDb } from "../lib/db.js";
import { getIstDateKey, isIstDailyWindow } from "../lib/istSchedule.js";
import { logger } from "../lib/logger.js";
import { leadService } from "../services/leadService.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";

const INTERVAL_MS = 15 * 60 * 1000;
const IST_DIGEST_HOUR = 9;

let syncTimer: ReturnType<typeof setInterval> | undefined;
let lastColdRunDate: string | null = null;
let lastDigestRunDate: string | null = null;

export async function syncColdLeadAlerts(now = new Date()) {
  const istDate = getIstDateKey(now);
  if (!isIstDailyWindow(IST_DIGEST_HOUR, 15, now)) {
    return { skipped: true, reason: "outside_window" as const };
  }
  if (lastColdRunDate === istDate) {
    return { skipped: true, reason: "already_ran" as const };
  }

  const { marked, totalCold } = await leadService.markColdLeads();
  lastColdRunDate = istDate;

  if (marked === 0) {
    return { marked, totalCold, notified: 0 };
  }

  const db = getDb();
  const notifications = createNotificationService(db);

  const managers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.orgId, SINGLE_TENANT_ORG_ID),
        eq(users.isActive, true),
        inArray(users.role, ["admin", "manager"]),
      ),
    );

  let notified = 0;
  for (const manager of managers) {
    const row = await notifications.createNotification(
      manager.id,
      NOTIFICATION_TYPES.COLD_LEADS_ALERT,
      {
        coldCount: totalCold,
        newlyMarked: marked,
      },
    );
    if (row) notified += 1;
  }

  logger.info("Cold lead alerts sent", { marked, totalCold, notified });
  return { marked, totalCold, notified };
}

export async function syncDailyDigest(now = new Date()) {
  const istDate = getIstDateKey(now);
  if (!isIstDailyWindow(IST_DIGEST_HOUR, 15, now)) {
    return { skipped: true, reason: "outside_window" as const };
  }
  if (lastDigestRunDate === istDate) {
    return { skipped: true, reason: "already_ran" as const };
  }

  const db = getDb();
  const notifications = createNotificationService(db);

  const agents = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.isActive, true), eq(users.role, "agent")),
    );

  let sent = 0;
  for (const agent of agents) {
    const counts = await leadService.getAgentDigestCounts(agent.id);
    if (counts.followUpsDueToday === 0 && counts.coldLeads === 0 && counts.overdueFollowUps === 0) {
      continue;
    }

    const row = await notifications.createNotification(agent.id, NOTIFICATION_TYPES.DAILY_DIGEST, {
      followUpsDueToday: counts.followUpsDueToday,
      overdueFollowUps: counts.overdueFollowUps,
      coldLeads: counts.coldLeads,
      agentName: agent.name,
    });
    if (row) sent += 1;
  }

  lastDigestRunDate = istDate;
  logger.info("Daily digest notifications sent", { sent, agents: agents.length });
  return { sent, agents: agents.length };
}

export async function syncDailyFollowUpJobs(now = new Date()) {
  const cold = await syncColdLeadAlerts(now);
  const digest = await syncDailyDigest(now);
  return { cold, digest };
}

export function startDailyFollowUpJobs() {
  if (syncTimer || process.env.VITEST === "true") {
    return;
  }

  logger.info("Starting daily follow-up jobs (cold + digest)", { intervalMs: INTERVAL_MS });

  syncTimer = setInterval(() => {
    void syncDailyFollowUpJobs().catch((error) => {
      logger.error("Daily follow-up job failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, INTERVAL_MS);

  if (typeof syncTimer === "object" && "unref" in syncTimer) {
    syncTimer.unref();
  }
}

export function stopDailyFollowUpJobs() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
  lastColdRunDate = null;
  lastDigestRunDate = null;
}

/** Test helper — reset daily dedupe state. */
export function resetDailyFollowUpJobState() {
  lastColdRunDate = null;
  lastDigestRunDate = null;
}
