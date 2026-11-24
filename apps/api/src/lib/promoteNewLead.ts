/**
 * Moves untouched `new` leads to `contacted` (Pending tab) when an agent
 * calls or otherwise touches them without an explicit status update.
 */
import { leadActivities, leads } from "@propninja/db";
import { and, eq, isNull } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";

export type PromoteNewLeadReason =
  | "call_logged"
  | "follow_up_set"
  | "contact_touch"
  | "aged_24h"
  | "backfill_contacted";

/**
 * Scheduling a callback on an untouched New lead must leave New (otherwise the
 * aging job clears follow-ups on remaining `new` rows). Forms often re-send
 * `leadStatus: "new"`; treat that as unset when a follow-up is being set.
 */
export function resolvedStatusForNewLeadUpdate(
  existingStatus: string,
  requestedStatus: string | undefined,
  nextFollowupAt: string | Date | null | undefined,
): string | undefined {
  if (
    existingStatus === "new" &&
    nextFollowupAt != null &&
    (requestedStatus === undefined || requestedStatus === "new")
  ) {
    return "contacted";
  }
  return requestedStatus;
}

export async function promoteNewLeadToContacted(
  leadId: string,
  options: { userId?: string | null; reason: PromoteNewLeadReason; at?: Date } = {
    reason: "contact_touch",
  },
): Promise<boolean> {
  const at = options.at ?? new Date();

  const [updated] = await db
    .update(leads)
    .set({
      leadStatus: "contacted",
      lastActivityAt: at,
      updatedAt: at,
    })
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        eq(leads.id, leadId),
        eq(leads.leadStatus, "new"),
        isNull(leads.deletedAt),
      ),
    )
    .returning({ id: leads.id });

  if (!updated) return false;

  if (options.userId) {
    await db.insert(leadActivities).values({
      orgId: SINGLE_TENANT_ORG_ID,
      leadId,
      userId: options.userId,
      type: "status_change",
      metadata: {
        from: "new",
        to: "contacted",
        reason: options.reason,
        auto: true,
      },
    });
  }

  return true;
}
