import { notifications } from "@propninja/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../lib/db.js";
import { logger } from "../lib/logger.js";

export const NOTIFICATION_TYPES = {
  LEAD_ASSIGNED: "lead_assigned",
  FOLLOWUP_DUE: "followup_due",
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

export function createNotificationService(db: Database) {
  return {
    async createNotification(
      userId: string,
      type: NotificationType | string,
      payload: Record<string, unknown>,
    ) {
      try {
        const [row] = await db.insert(notifications).values({ userId, type, payload }).returning();
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

    async hasFollowupNotification(userId: string, leadId: string, nextFollowupAt: string) {
      const [row] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, NOTIFICATION_TYPES.FOLLOWUP_DUE),
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
