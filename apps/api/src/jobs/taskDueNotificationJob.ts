/**
 * Notify assignees when open tasks become due (dueAt <= now).
 */
import { tasks } from "@propninja/db";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";

const INTERVAL_MS = 5 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | undefined;

export async function syncTaskDueNotifications() {
  const db = getDb();
  const notifications = createNotificationService(db);
  const now = new Date();

  const dueTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      assignedTo: tasks.assignedTo,
      leadId: tasks.leadId,
      dueAt: tasks.dueAt,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.orgId, SINGLE_TENANT_ORG_ID),
        isNotNull(tasks.assignedTo),
        isNotNull(tasks.dueAt),
        lte(tasks.dueAt, now),
        inArray(tasks.status, ["pending", "in_progress"]),
      ),
    );

  let created = 0;

  for (const task of dueTasks) {
    if (!task.assignedTo || !task.dueAt) continue;

    const dueAt = task.dueAt.toISOString();
    const exists = await notifications.hasTaskDueNotification(task.assignedTo, task.id, dueAt);
    if (exists) continue;

    const row = await notifications.createNotification(
      task.assignedTo,
      NOTIFICATION_TYPES.TASK_DUE,
      {
        taskId: task.id,
        taskTitle: task.title,
        leadId: task.leadId ?? undefined,
        dueAt,
        message: `Due now: ${task.title}`,
      },
    );
    if (row) created += 1;
  }

  if (created > 0) {
    logger.info("Task due notifications created", { created, checked: dueTasks.length });
  }

  return { created, checked: dueTasks.length };
}

export function startTaskDueNotificationJob() {
  if (syncTimer || process.env.VITEST === "true") return;

  logger.info("Starting task-due notification scheduler", { intervalMs: INTERVAL_MS });

  void syncTaskDueNotifications().catch((error) => {
    logger.error("Initial task-due notification sync failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  syncTimer = setInterval(() => {
    void syncTaskDueNotifications().catch((error) => {
      logger.error("Scheduled task-due notification sync failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, INTERVAL_MS);
  syncTimer.unref?.();
}

export function stopTaskDueNotificationJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}
