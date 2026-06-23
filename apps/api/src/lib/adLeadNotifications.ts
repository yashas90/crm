import { users } from "@propninja/db";
import { and, eq, inArray } from "drizzle-orm";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import type { Database } from "./db.js";

type LeadLike = {
  id: string;
  firstName: string;
  lastName: string | null;
  assignedTo: string | null;
  leadSource?: string | null;
};

export async function notifyNewAdLeadReceived(
  db: Database,
  lead: LeadLike,
  options: { source: "facebook_ads" | "google_ads"; campaignName?: string },
) {
  const leadName = `${lead.firstName} ${lead.lastName ?? ""}`.trim() || "New lead";
  const sourceLabel = options.source === "facebook_ads" ? "Meta" : "Google Ads";
  const campaign =
    options.campaignName?.trim() || (options.source === "facebook_ads" ? "Meta Ads" : "Google Ads");

  const payload = {
    leadId: lead.id,
    leadName,
    source: options.source,
    sourceLabel,
    campaignName: campaign,
  };

  const recipientIds = new Set<string>();

  if (lead.assignedTo) {
    recipientIds.add(lead.assignedTo);
  } else {
    const managers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.orgId, SINGLE_TENANT_ORG_ID),
          eq(users.isActive, true),
          inArray(users.role, ["admin", "manager"]),
        ),
      );

    for (const row of managers) {
      recipientIds.add(row.id);
    }
  }

  if (recipientIds.size === 0) {
    return;
  }

  const notifications = createNotificationService(db);
  await Promise.all(
    [...recipientIds].map((userId) =>
      notifications.createNotification(userId, NOTIFICATION_TYPES.NEW_AD_LEAD, payload),
    ),
  );
}
