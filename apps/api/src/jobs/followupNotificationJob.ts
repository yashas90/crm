import { leads } from "@propninja/db";
import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";

const INTERVAL_MS = 15 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncFollowupNotifications() {
  const db = getDb();
  const notifications = createNotificationService(db);
  const now = new Date();

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
        lte(leads.nextFollowupAt, now),
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
    );
    if (exists) continue;

    const leadName = `${lead.firstName} ${lead.lastName}`.trim();
    const row = await notifications.createNotification(
      lead.assignedTo,
      NOTIFICATION_TYPES.FOLLOWUP_DUE,
      {
        leadId: lead.id,
        leadName,
        nextFollowupAt,
      },
    );

    if (row) created += 1;
  }

  if (created > 0) {
    logger.info("Follow-up notifications created", { created, checked: dueLeads.length });
  }

  return { created, checked: dueLeads.length };
}

export function startFollowupNotificationJob() {
  if (syncTimer || process.env.VITEST === "true") {
    return;
  }

  logger.info("Starting follow-up notification scheduler", { intervalMs: INTERVAL_MS });

  void syncFollowupNotifications().catch((error) => {
    logger.error("Initial follow-up notification sync failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  syncTimer = setInterval(() => {
    void syncFollowupNotifications().catch((error) => {
      logger.error("Scheduled follow-up notification sync failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, INTERVAL_MS);

  if (typeof syncTimer === "object" && "unref" in syncTimer) {
    syncTimer.unref();
  }
}

export function stopFollowupNotificationJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
