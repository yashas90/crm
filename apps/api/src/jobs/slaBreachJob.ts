import { leads } from "@propninja/db";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";
import {
  SLA_DEFAULT_INACTIVE_DAYS,
  lastEngagementAtSql,
  slaService,
} from "../services/slaService.js";

const INTERVAL_MS = 15 * 60 * 1000;
/** Cap catch-up notifies per run so first deploy after enabling doesn't flood Expo. */
const CATCH_UP_LIMIT = 150;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncSlaBreachFlags() {
  const result = await slaService.syncBreachedFlags();
  const notified = await notifySlaBreaches(result.newlyFlagged);

  if (result.flagged > 0 || result.cleared > 0 || notified > 0) {
    logger.info("SLA breach flags synced", {
      flagged: result.flagged,
      cleared: result.cleared,
      notified,
    });
  }

  return { ...result, notified };
}

async function notifySlaBreaches(
  newlyFlagged: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    assignedTo: string | null;
    daysSinceActivity: number;
  }>,
) {
  const db = getDb();
  const notifications = createNotificationService(db);
  let notified = 0;

  const candidates = [...newlyFlagged];

  // Catch-up: already-flagged leads that never received an SLA notification.
  if (candidates.length < CATCH_UP_LIMIT) {
    const lastEngagement = lastEngagementAtSql();
    const existing = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        assignedTo: leads.assignedTo,
        daysSinceActivity: sql<number>`extract(day from now() - ${lastEngagement})::int`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.orgId, SINGLE_TENANT_ORG_ID),
          isNull(leads.deletedAt),
          isNotNull(leads.slaBreachedAt),
          isNotNull(leads.assignedTo),
          sql`${leads.leadStatus} in ('new', 'contacted', 'qualified', 'negotiation')`,
        ),
      )
      .limit(CATCH_UP_LIMIT);

    const seen = new Set(candidates.map((c) => c.id));
    for (const row of existing) {
      if (seen.has(row.id)) continue;
      candidates.push(row);
      if (candidates.length >= CATCH_UP_LIMIT) break;
    }
  }

  for (const lead of candidates) {
    if (!lead.assignedTo) continue;

    const exists = await notifications.hasSlaBreachNotification(lead.assignedTo, lead.id);
    if (exists) continue;

    const leadName = `${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}`.trim();
    const days = lead.daysSinceActivity ?? SLA_DEFAULT_INACTIVE_DAYS;
    const row = await notifications.createNotification(
      lead.assignedTo,
      NOTIFICATION_TYPES.SLA_BREACH,
      {
        leadId: lead.id,
        leadName,
        daysSinceActivity: days,
        message: `${leadName} inactive for ${days}+ days — SLA breach`,
      },
    );
    if (row) notified += 1;
  }

  return notified;
}

export function startSlaBreachJob() {
  if (syncTimer || process.env.VITEST === "true") return;

  logger.info("Starting SLA breach sync scheduler", { intervalMs: INTERVAL_MS });

  void syncSlaBreachFlags().catch((err) => {
    logger.warn("SLA breach sync failed on startup", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  syncTimer = setInterval(() => {
    void syncSlaBreachFlags().catch((err) => {
      logger.warn("SLA breach sync failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, INTERVAL_MS);
  syncTimer.unref?.();
}

export function stopSlaBreachJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
