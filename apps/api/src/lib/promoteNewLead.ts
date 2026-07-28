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
