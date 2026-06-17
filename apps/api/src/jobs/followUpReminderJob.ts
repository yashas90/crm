import { leads, users } from "@propninja/db";
import { and, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { getDb } from "../lib/db.js";
import { FOLLOWUP_REMINDER_MINUTES } from "../lib/followUp.js";
import { logger } from "../lib/logger.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";

const INTERVAL_MS = 60 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncFollowupReminders() {
  const db = getDb();
  const notifications = createNotificationService(db);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + FOLLOWUP_REMINDER_MINUTES * 60_000);

  const dueLeads = await db
    .select({
      id: leads.id,
      firstName: leads.firstName,
      lastName: leads.lastName,
      assignedTo: leads.assignedTo,
      nextFollowupAt: leads.nextFollowupAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
        isNotNull(leads.assignedTo),
        isNotNull(leads.nextFollowupAt),
        gt(leads.nextFollowupAt, now),
        lte(leads.nextFollowupAt, windowEnd),
      ),
    );

  let created = 0;

  for (const lead of dueLeads) {
    if (!lead.assignedTo || !lead.nextFollowupAt) continue;

    const nextFollowupAt = lead.nextFollowupAt.toISOString();
    const exists = await notifications.hasFollowupNotification(
      lead.assignedTo,
      lead.id,
      nextFollowupAt,
      NOTIFICATION_TYPES.FOLLOWUP_REMINDER,
    );
    if (exists) continue;

    const leadName = `${lead.firstName} ${lead.lastName}`.trim();
    const row = await notifications.createNotification(
      lead.assignedTo,
      NOTIFICATION_TYPES.FOLLOWUP_REMINDER,
      {
        leadId: lead.id,
        leadName,
        nextFollowupAt,
      },
    );

    if (row) created += 1;
  }

  if (created > 0) {
    logger.info("Follow-up reminders sent", { created, checked: dueLeads.length });
  }

  return { created, checked: dueLeads.length };
}

export function startFollowupReminderJob() {
  if (syncTimer || process.env.VITEST === "true") {
    return;
  }

  logger.info("Starting follow-up reminder scheduler (hourly)", { intervalMs: INTERVAL_MS });

  void syncFollowupReminders().catch((error) => {
    logger.error("Initial follow-up reminder sync failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  syncTimer = setInterval(() => {
    void syncFollowupReminders().catch((error) => {
      logger.error("Scheduled follow-up reminder sync failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, INTERVAL_MS);

  if (typeof syncTimer === "object" && "unref" in syncTimer) {
    syncTimer.unref();
  }
}

export function stopFollowupReminderJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
