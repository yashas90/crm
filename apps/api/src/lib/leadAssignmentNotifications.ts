import type { Database } from "./db.js";
import {
  NOTIFICATION_TYPES,
  createNotificationService,
} from "../services/notificationService.js";

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
  await notifications.createNotification(params.assigneeId, NOTIFICATION_TYPES.LEAD_ASSIGNED, {
    leadId: params.leadId,
    leadName: params.leadName,
    assignedBy: params.assignedByName,
  });
}
