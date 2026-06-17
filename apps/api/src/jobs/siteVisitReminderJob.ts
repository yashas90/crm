import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { formatVisitTimeDisplay } from "../lib/siteVisitTime.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";
import { siteVisitService } from "../services/siteVisitService.js";

const INTERVAL_MS = 5 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncSiteVisitReminders(now = new Date()) {
  const db = getDb();
  const notifications = createNotificationService(db);
  const dueVisits = await siteVisitService.findDueForReminder(now);

  let sent = 0;

  for (const visit of dueVisits) {
    const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}`.trim() : "Lead";
    const timeLabel = formatVisitTimeDisplay(visit.visitTime);
    const property = visit.propertyLabel ?? visit.propertyAddress ?? "Property";

    const row = await notifications.createNotification(
      visit.agentId,
      NOTIFICATION_TYPES.SITE_VISIT_REMINDER,
      {
        siteVisitId: visit.id,
        leadId: visit.leadId,
        leadName,
        visitDate: visit.visitDate,
        visitTime: timeLabel,
        property,
      },
    );

    if (row) {
      await siteVisitService.markReminderSent(visit.id);
      sent += 1;
    }
  }

  if (sent > 0) {
    logger.info("Site visit reminders sent", { sent, checked: dueVisits.length });
  }

  return { sent, checked: dueVisits.length };
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
