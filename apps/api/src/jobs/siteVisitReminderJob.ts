import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";
import {
  markMissedSiteVisits,
  runSiteVisitAutomation,
} from "../services/siteVisitAutomationService.js";
import { siteVisitService } from "../services/siteVisitService.js";

const INTERVAL_MS = 5 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncSiteVisitReminders(now = new Date()) {
  const db = getDb();
  const notifications = createNotificationService(db);
  const dueVisits = await siteVisitService.findDueForReminders(now);

  let sent = 0;

  for (const visit of dueVisits) {
    const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}`.trim() : "Lead";
    const property = visit.propertyLabel ?? visit.propertyAddress ?? "Property";

    await notifications.createNotification(visit.agentId, NOTIFICATION_TYPES.SITE_VISIT_REMINDER, {
      siteVisitId: visit.id,
      leadId: visit.leadId,
      leadName,
      visitDate: visit.visitDate,
      visitTime: visit.visitTime,
      property,
      tierMinutes: visit.tierMinutes,
    });

    await runSiteVisitAutomation(visit.id, "reminder", {
      actorUserId: visit.agentId,
      database: db,
    });

    await siteVisitService.markReminderTierSent(visit.id, visit.tierMinutes);
    sent += 1;
  }

  const missed = await markMissedSiteVisits(db);

  if (sent > 0 || missed > 0) {
    logger.info("Site visit reminder sync", { sent, checked: dueVisits.length, missed });
  }

  return { sent, checked: dueVisits.length, missed };
}

export function startSiteVisitReminderJob() {
  if (syncTimer || process.env.VITEST === "true") {
    return;
  }

  logger.info("Starting site visit reminder scheduler", { intervalMs: INTERVAL_MS });

  void syncSiteVisitReminders().catch((error) => {
    logger.error("Initial site visit reminder sync failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  syncTimer = setInterval(() => {
    void syncSiteVisitReminders().catch((error) => {
      logger.error("Site visit reminder sync failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, INTERVAL_MS);

  syncTimer.unref?.();
}

export function stopSiteVisitReminderJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
