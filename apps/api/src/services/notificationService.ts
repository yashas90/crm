import { notifications } from "@propninja/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { sendPushNotification } from "../lib/pushNotifications.js";

export const NOTIFICATION_TYPES = {
  LEAD_ASSIGNED: "lead_assigned",
  LEADS_BULK_ASSIGNED: "leads_bulk_assigned",
  FOLLOWUP_DUE: "followup_due",
  FOLLOWUP_REMINDER: "followup_reminder",
  TASK_ASSIGNED: "task_assigned",
  CALL_FOLLOWUP_SET: "call_followup_set",
  SITE_VISIT_REMINDER: "site_visit_reminder",
  SITE_VISIT_SCHEDULED: "site_visit_scheduled",
  COLD_LEADS_ALERT: "cold_leads_alert",
  DAILY_DIGEST: "daily_digest",
  NEW_AD_LEAD: "new_ad_lead",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

function formatNotification(row: typeof notifications.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    payload: row.payload ?? {},
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

function pushMessageFor(type: string, payload: Record<string, unknown>) {
  const leadName = typeof payload.leadName === "string" ? payload.leadName : "a lead";
  const assignedBy = typeof payload.assignedBy === "string" ? payload.assignedBy : "Someone";
  const taskTitle = typeof payload.taskTitle === "string" ? payload.taskTitle : "a task";
  const sourceLabel = typeof payload.sourceLabel === "string" ? payload.sourceLabel : "Meta";
  const campaignName =
    typeof payload.campaignName === "string" ? payload.campaignName : "your campaign";

  switch (type) {
    case NOTIFICATION_TYPES.LEAD_ASSIGNED:
      return {
        title: "Lead assigned",
        body: `${assignedBy} assigned you ${leadName}`,
      };
    case NOTIFICATION_TYPES.LEADS_BULK_ASSIGNED: {
      const count = typeof payload.count === "number" ? payload.count : 0;
      const label = count === 1 ? "1 lead" : `${count} leads`;
      return {
        title: "Leads assigned",
        body: `${assignedBy} assigned you ${label}`,
      };
    }
    case NOTIFICATION_TYPES.NEW_AD_LEAD:
      return {
        title: `New ${sourceLabel} lead`,
        body: `${leadName} from ${campaignName}`,
      };
    case NOTIFICATION_TYPES.FOLLOWUP_DUE:
      return {
        title: "Follow-up due",
        body: `Follow-up due for ${leadName}`,
      };
    case NOTIFICATION_TYPES.TASK_ASSIGNED:
      return {
        title: "Task assigned",
        body: `You were assigned: ${taskTitle}`,
      };
    case NOTIFICATION_TYPES.CALL_FOLLOWUP_SET:
      return {
        title: "Follow-up scheduled",
        body:
          typeof payload.message === "string"
            ? payload.message
            : `Reminder set: Call back ${leadName}`,
      };
    default:
      return {
        title: "PropNinja",
        body: "You have a new notification",
      };
  }
}

function pushDataFor(type: string, payload: Record<string, unknown>) {
  const data: Record<string, unknown> = { type };
  if (typeof payload.leadId === "string") data.leadId = payload.leadId;
  if (typeof payload.taskId === "string") data.taskId = payload.taskId;
  return data;
}

export function createNotificationService(db: Database) {
  return {
    async createNotification(
      userId: string,
      type: NotificationType | string,
      payload: Record<string, unknown>,
      options?: { push?: boolean },
    ) {
      try {
        const [row] = await db.insert(notifications).values({ userId, type, payload }).returning();
        if (row && options?.push !== false) {
          const { title, body } = pushMessageFor(type, payload);
          void sendPushNotification(db, userId, title, body, pushDataFor(type, payload)).catch(
            (error) => {
              logger.error("Push notification failed", {
                userId,
                type,
                message: error instanceof Error ? error.message : String(error),
              });
            },
          );
        }
        return row ? formatNotification(row) : null;
      } catch (error) {
        logger.error("Failed to create notification", {
          userId,
          type,
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },

    async listNotifications(userId: string, limit = 50) {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      return rows.map(formatNotification);
    },

    async countUnread(userId: string) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

      return row?.count ?? 0;
    },

    async markAsRead(userId: string, ids: string[]) {
      if (ids.length === 0) return 0;

      const updated = await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)))
        .returning({ id: notifications.id });

      return updated.length;
    },

    async hasFollowupNotification(
      userId: string,
      leadId: string,
      nextFollowupAt: string,
      type: NotificationType | string = NOTIFICATION_TYPES.FOLLOWUP_DUE,
    ) {
      const [row] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, type),
            sql`${notifications.payload}->>'leadId' = ${leadId}`,
            sql`${notifications.payload}->>'nextFollowupAt' = ${nextFollowupAt}`,
          ),
        )
        .limit(1);

      return Boolean(row);
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
