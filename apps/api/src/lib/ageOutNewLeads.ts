/**
 * Lead classification aging: keep `new` for ≤24h untouched leads only.
 * - Any `new` lead that was called/touched → `contacted` (Pending)
 * - Any `new` lead older than 24h with no status update → `contacted` (Pending)
 */
import { callRecords, leadActivities, leads } from "@propninja/db";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";
import { logger } from "./logger.js";

export const NEW_LEAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type AgeOutNewLeadsResult = {
  promotedTouched: number;
  promotedAged: number;
  total: number;
};

/** SQL: new lead has been contacted (call logged or lastContactedAt set). */
function touchedNewLeadSql() {
  return sql`(
    ${leads.lastContactedAt} is not null
    OR EXISTS (
      SELECT 1 FROM ${callRecords} cr
      WHERE cr.lead_id = ${leads.id}
        AND cr.org_id = ${leads.orgId}
    )
  )`;
}

/**
 * Promotes stuck `new` leads into Pending (`contacted`):
 * 1) already called/touched (fixes legacy Meta leads stuck on New)
 * 2) created more than 24 hours ago without a status update
 */
export async function ageOutStaleNewLeads(
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<AgeOutNewLeadsResult> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - NEW_LEAD_MAX_AGE_MS);

  const touched = await db
    .update(leads)
    .set({
      leadStatus: "contacted",
      lastActivityAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(leads.orgId, orgId),
        isNull(leads.deletedAt),
        eq(leads.leadStatus, "new"),
        touchedNewLeadSql(),
      ),
    )
    .returning({ id: leads.id });

  const aged = await db
    .update(leads)
    .set({
      leadStatus: "contacted",
      lastActivityAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(leads.orgId, orgId),
        isNull(leads.deletedAt),
        eq(leads.leadStatus, "new"),
        lt(leads.createdAt, cutoff),
      ),
    )
    .returning({ id: leads.id });

  const touchedIds = touched.map((r) => r.id);
  const agedIds = aged.map((r) => r.id);

  await insertAutoStatusActivities(orgId, touchedIds, "backfill_contacted");
  await insertAutoStatusActivities(orgId, agedIds, "aged_24h");

  const result: AgeOutNewLeadsResult = {
    promotedTouched: touchedIds.length,
    promotedAged: agedIds.length,
    total: touchedIds.length + agedIds.length,
  };

  if (result.total > 0) {
    logger.info("Aged out stale new leads into Pending", result);
  }

  return result;
}

async function insertAutoStatusActivities(
  orgId: string,
  leadIds: string[],
  reason: "backfill_contacted" | "aged_24h",
) {
  if (leadIds.length === 0) return;

  // Cap activity fan-out for large backfills (status is already updated).
  const sample = leadIds.slice(0, 500);
  await db.insert(leadActivities).values(
    sample.map((leadId) => ({
      orgId,
      leadId,
      userId: null,
      type: "status_change" as const,
      metadata: {
        from: "new",
        to: "contacted",
        reason,
        auto: true,
      },
    })),
  );
}

/** Fresh New window used by list/count queries as a safety net alongside the aging job. */
export function newLeadFreshnessCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - NEW_LEAD_MAX_AGE_MS);
}

/** True when a lead still qualifies for the New bucket (status new + ≤24h). */
export function isFreshNewLead(input: {
  leadStatus: string;
  createdAt: Date | string;
  now?: Date;
}): boolean {
  if (input.leadStatus !== "new") return false;
  const created = new Date(input.createdAt).getTime();
  const now = (input.now ?? new Date()).getTime();
  return now - created <= NEW_LEAD_MAX_AGE_MS;
}

/** Exported for tests — condition used when status=new list filter is applied. */
export function freshNewLeadWhere(now: Date = new Date()) {
  return and(
    eq(leads.leadStatus, "new"),
    sql`${leads.createdAt} >= ${newLeadFreshnessCutoff(now)}`,
  );
}

/** Pending includes contacted + any stale new that the job has not yet moved (defense). */
export function pendingLeadWhere(now: Date = new Date()) {
  return or(
    eq(leads.leadStatus, "contacted"),
    and(eq(leads.leadStatus, "new"), lt(leads.createdAt, newLeadFreshnessCutoff(now))),
  );
}
