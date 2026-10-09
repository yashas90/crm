import { contactPoolSettings, users } from "@propninja/db";
import { getIstDateKey, getIstDayBounds, isIstDailyWindow } from "@propninja/types/ist";
import { and, eq, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { sqlRows } from "../lib/contactPool/sql.js";
import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { sqlTimestamptz } from "../lib/sqlTimestamp.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";

const INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | undefined;

export function startContactPoolJob() {
  if (timer) return;
  logger.info("Starting calling-data maintenance");
  void runContactPoolMaintenance().catch(logMaintenanceFailure);
  timer = setInterval(() => {
    void runContactPoolMaintenance().catch(logMaintenanceFailure);
  }, INTERVAL_MS);
  timer.unref?.();
}

function logMaintenanceFailure(error: unknown) {
  logger.error("Calling-data maintenance failed", {
    message: error instanceof Error ? error.message : String(error),
  });
}

export async function runContactPoolMaintenance(now = new Date()) {
  const db = getDb();
  const notifications = createNotificationService(db);
  const dateKey = getIstDateKey(now);
  await ensureSettings(db);

  if (isIstDailyWindow(0, 20, now)) {
    const [settings] = await db
      .select({ last: contactPoolSettings.lastLimitResetDate })
      .from(contactPoolSettings)
      .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID))
      .limit(1);
    if (settings?.last !== dateKey) {
      await db.execute(sql`
        INSERT INTO agent_daily_limits (org_id, agent_id, date, contacts_requested_today, contacts_called_today, max_daily_limit)
        SELECT u.org_id, u.id, ${dateKey}::date, 0, 0, LEAST(COALESCE(l.max_daily_limit, 100), 100)
        FROM users u
        LEFT JOIN agent_calling_limits l ON l.agent_id = u.id
        WHERE u.org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND u.role = 'agent' AND u.is_active = true
        ON CONFLICT (agent_id, date) DO NOTHING
      `);
      await db
        .update(contactPoolSettings)
        .set({ lastLimitResetDate: dateKey, updatedAt: now })
        .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID));
      logger.info("Daily calling limits reset", { dateKey });
    }
  }

  if (isIstDailyWindow(8, 20, now)) {
    await morningReminder(db, notifications, dateKey, now);
  }
  if (isIstDailyWindow(20, 20, now)) {
    await eveningSummary(db, notifications, dateKey, now);
  }
  await callbackReminders(db, notifications, now);
  await poolLowAlert(db, notifications, now);
}

async function ensureSettings(db: ReturnType<typeof getDb>) {
  await db
    .insert(contactPoolSettings)
    .values({ orgId: SINGLE_TENANT_ORG_ID })
    .onConflictDoNothing();
}

async function morningReminder(
  db: ReturnType<typeof getDb>,
  notifications: ReturnType<typeof createNotificationService>,
  dateKey: string,
  now: Date,
) {
  const [settings] = await db
    .select({ last: contactPoolSettings.lastMorningReminderDate })
    .from(contactPoolSettings)
    .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID))
    .limit(1);
  if (settings?.last === dateKey) return;
  const { start } = getIstDayBounds(0, now);
  const rows = sqlRows(
    await db.execute(sql`
      SELECT agent_id, count(*)::int AS pending
      FROM agent_calling_data
      WHERE deleted_at IS NULL
        AND assigned_at < ${sqlTimestamptz(start)}
        AND status IN ('pending', 'retry', 'callback')
      GROUP BY agent_id
    `),
  );
  for (const row of rows) {
    const pending = Number(row.pending);
    await notifications.createNotification(
      String(row.agent_id),
      NOTIFICATION_TYPES.PENDING_CONTACTS,
      {
        title: "Contacts still waiting",
        message: `You have ${pending} contacts pending from yesterday. Request more after calling them.`,
        pending,
      },
    );
  }
  await db
    .update(contactPoolSettings)
    .set({ lastMorningReminderDate: dateKey, updatedAt: now })
    .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID));
}

async function eveningSummary(
  db: ReturnType<typeof getDb>,
  notifications: ReturnType<typeof createNotificationService>,
  dateKey: string,
  now: Date,
) {
  const [settings] = await db
    .select({ last: contactPoolSettings.lastEveningSummaryDate })
    .from(contactPoolSettings)
    .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID))
    .limit(1);
  if (settings?.last === dateKey) return;
  const { start } = getIstDayBounds(0, now);
  const rows = sqlRows(
    await db.execute(sql`
      SELECT agent_id,
        count(*)::int AS called,
        count(*) FILTER (WHERE outcome = 'interested')::int AS interested,
        count(*) FILTER (WHERE outcome = 'callback')::int AS callbacks
      FROM contact_call_logs
      WHERE called_at >= ${sqlTimestamptz(start)}
      GROUP BY agent_id
    `),
  );
  for (const row of rows) {
    await notifications.createNotification(
      String(row.agent_id),
      NOTIFICATION_TYPES.CALLING_SUMMARY,
      {
        title: "Today's calling summary",
        message: `Today: Called ${row.called} | Interested ${row.interested} | Callbacks ${row.callbacks}`,
      },
    );
  }
  await db
    .update(contactPoolSettings)
    .set({ lastEveningSummaryDate: dateKey, updatedAt: now })
    .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID));
}

async function callbackReminders(
  db: ReturnType<typeof getDb>,
  notifications: ReturnType<typeof createNotificationService>,
  now: Date,
) {
  const due = sqlRows(
    await db.execute(sql`
      SELECT record_id, agent_id, name, phone
      FROM agent_calling_data
      WHERE deleted_at IS NULL
        AND status = 'callback'
        AND callback_notified_at IS NULL
        AND callback_scheduled_at IS NOT NULL
        AND callback_scheduled_at <= ${sqlTimestamptz(now)}
    `),
  );
  for (const row of due) {
    await notifications.createNotification(String(row.agent_id), NOTIFICATION_TYPES.CALLBACK_DUE, {
      title: "Callback due",
      message: `Time to call back ${row.name} - ${row.phone}`,
      recordId: row.record_id,
    });
    await db.execute(sql`
      UPDATE agent_calling_data
      SET callback_notified_at = ${sqlTimestamptz(now)}
      WHERE record_id = ${String(row.record_id)}::uuid
    `);
  }
}

async function poolLowAlert(
  db: ReturnType<typeof getDb>,
  notifications: ReturnType<typeof createNotificationService>,
  now: Date,
) {
  const [settings] = await db
    .select()
    .from(contactPoolSettings)
    .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID))
    .limit(1);
  const threshold = settings?.lowPoolThreshold ?? 500;
  const [countRow] = sqlRows(
    await db.execute(sql`
      SELECT count(*)::int AS count FROM contact_pool
      WHERE org_id = ${SINGLE_TENANT_ORG_ID}::uuid AND status = 'unassigned'
    `),
  );
  const remaining = Number(countRow?.count ?? 0);
  if (remaining >= threshold) return;
  const last = settings?.lastLowPoolAlertAt;
  if (last && getIstDateKey(last) === getIstDateKey(now)) return;
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.orgId, SINGLE_TENANT_ORG_ID), eq(users.role, "admin"), eq(users.isActive, true)),
    );
  for (const admin of admins) {
    await notifications.createNotification(admin.id, NOTIFICATION_TYPES.POOL_LOW, {
      title: "Calling pool running low",
      message: `Only ${remaining} unassigned contacts remaining in pool. Please upload more data.`,
      remaining,
    });
  }
  await db
    .update(contactPoolSettings)
    .set({ lastLowPoolAlertAt: now, updatedAt: now })
    .where(eq(contactPoolSettings.orgId, SINGLE_TENANT_ORG_ID));
}
