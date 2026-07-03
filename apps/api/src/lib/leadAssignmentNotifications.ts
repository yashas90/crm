import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";
import type { Database } from "./db.js";

/** In-app only — no push/email per lead; clients play a chime when polling picks this up. */
const IN_APP_ONLY = { push: false } as const;

export async function notifyLeadAssigned(
  db: Database,
  params: {
    assigneeId: string;
    actingUserId: string;
    assignedByName: string;
    leadId: string;
    leadName: string;
  },
) {
  if (params.assigneeId === params.actingUserId) {
    return;
  }

  const notifications = createNotificationService(db);
  await notifications.createNotification(
    params.assigneeId,
    NOTIFICATION_TYPES.LEAD_ASSIGNED,
    {
      leadId: params.leadId,
      leadName: params.leadName,
      assignedBy: params.assignedByName,
    },
    IN_APP_ONLY,
  );
}

/** One summary notification per agent after bulk import or bulk assign (not one per lead). */
export async function notifyBulkLeadsAssigned(
  db: Database,
  params: {
    assignments: Record<string, number>;
    actingUserId: string;
    assignedByName: string;
    source?: "bulk_import" | "bulk_assign";
  },
) {
  const notifications = createNotificationService(db);
  const entries = Object.entries(params.assignments).filter(
    ([assigneeId, count]) => assigneeId !== params.actingUserId && count > 0,
  );

  await Promise.all(
    entries.map(([assigneeId, count]) =>
      notifications.createNotification(
        assigneeId,
        NOTIFICATION_TYPES.LEADS_BULK_ASSIGNED,
        {
          count,
          assignedBy: params.assignedByName,
          source: params.source ?? "bulk_assign",
        },
        IN_APP_ONLY,
      ),
    ),
  );
}
