import {
  adLeads,
  bookingDocuments,
  callRecords,
  emailLogs,
  facebookConversionEvents,
  facebookLeads,
  leadActivities,
  leadAssignments,
  leadDocumentShares,
  leadImportBatchItems,
  leads,
  projectUnits,
  siteVisits,
  tasks,
  tcfConsents,
  whatsappMessages,
} from "@propninja/db";
import { and, eq, inArray, isNotNull, isNull, lte, notInArray, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { sqlTimestamptz } from "./sqlTimestamp.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** NA leads (`not_interested` / `dropped`) are hard-deleted after 1 week in the NA pool. */
export const NA_LEAD_PURGE_AFTER_MS = 7 * DAY_MS;

/** Soft-deleted (Deleted tab) leads are hard-deleted after 48 hours. */
export const SOFT_DELETED_LEAD_PURGE_AFTER_MS = 48 * 60 * 60 * 1000;

/** @deprecated Use NA_LEAD_PURGE_AFTER_MS / SOFT_DELETED_LEAD_PURGE_AFTER_MS. */
export const LEAD_PURGE_AFTER_MS = NA_LEAD_PURGE_AFTER_MS;

const NA_STATUSES = ["not_interested", "dropped"] as const;

const BATCH_SIZE = 200;
/** Max NA leads removed per scheduler tick (large pools drain over one or two runs). */
const MAX_NA_PURGE_PER_RUN = 50_000;
/** Max soft-deleted leads removed per scheduler tick. */
const MAX_SOFT_DELETED_PURGE_PER_RUN = 5_000;

/**
 * Legacy fallback when `na_since_at` is null (pre-migration rows).
 * Must NOT use updatedAt — NA pool release refreshes that without changing NA age.
 */
function legacyNaStatusSinceSql() {
  return sql`COALESCE(
    (
      SELECT MAX(${leadActivities.createdAt})
      FROM ${leadActivities}
      WHERE ${leadActivities.leadId} = ${leads.id}
        AND ${leadActivities.type} = 'status_change'
        AND ${leadActivities.metadata}->>'to' IN ('not_interested', 'dropped')
    ),
    ${leads.createdAt}
  )`;
}

/**
 * NA leads due for hard-delete: `na_since_at` past cutoff (indexed), or legacy
 * rows with a null column whose status-change/created age is past cutoff.
 *
 * The legacy comparison MUST use `sqlTimestamptz` — interpolating a JS Date
 * into raw SQL becomes Date.toString() ("Fri Aug 21...") which Postgres rejects,
 * so the whole NA fetch throws and no NA leads are deleted.
 */
export function naLeadExpiredSql(cutoff: Date) {
  return or(
    lte(leads.naSinceAt, cutoff),
    and(isNull(leads.naSinceAt), sql`${legacyNaStatusSinceSql()} <= ${sqlTimestamptz(cutoff)}`),
  );
}

/**
 * Permanently remove dependent rows then the lead.
 * Handles FKs that are ON DELETE NO ACTION in the schema.
 */
export async function hardDeleteLead(leadId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId)))
      .limit(1);

    if (!existing) return false;

    await tx.delete(leadActivities).where(eq(leadActivities.leadId, leadId));
    await tx.delete(tcfConsents).where(eq(tcfConsents.leadId, leadId));
    await tx.delete(adLeads).where(eq(adLeads.leadId, leadId));
    await tx.delete(leadDocumentShares).where(eq(leadDocumentShares.leadId, leadId));
    await tx.delete(whatsappMessages).where(eq(whatsappMessages.leadId, leadId));
    await tx.delete(siteVisits).where(eq(siteVisits.leadId, leadId));
    await tx.delete(leadAssignments).where(eq(leadAssignments.leadId, leadId));

    await tx.update(callRecords).set({ leadId: null }).where(eq(callRecords.leadId, leadId));
    await tx.update(tasks).set({ leadId: null }).where(eq(tasks.leadId, leadId));
    await tx.update(emailLogs).set({ leadId: null }).where(eq(emailLogs.leadId, leadId));
    await tx
      .update(leadImportBatchItems)
      .set({ leadId: null })
      .where(eq(leadImportBatchItems.leadId, leadId));
    await tx
      .update(projectUnits)
      .set({ assignedLeadId: null })
      .where(eq(projectUnits.assignedLeadId, leadId));
    await tx
      .update(bookingDocuments)
      .set({ leadId: null })
      .where(eq(bookingDocuments.leadId, leadId));
    await tx.update(facebookLeads).set({ leadId: null }).where(eq(facebookLeads.leadId, leadId));
    await tx
      .update(facebookConversionEvents)
      .set({ leadId: null })
      .where(eq(facebookConversionEvents.leadId, leadId));

    const deleted = await tx
      .delete(leads)
      .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), eq(leads.id, leadId)))
      .returning({ id: leads.id });

    return deleted.length > 0;
  });
}

export type PurgeExpiredLeadsResult = {
  naPurged: number;
  softDeletedPurged: number;
  checked: number;
  failed: number;
};

async function fetchSoftDeletedBatch(cutoff: Date) {
  return db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNotNull(leads.deletedAt),
        lte(leads.deletedAt, cutoff),
      ),
    )
    .limit(BATCH_SIZE);
}

async function fetchNaBatch(cutoff: Date, excludeIds: string[] = []) {
  const filters = [
    eq(leads.orgId, SINGLE_TENANT_ORG_ID),
    isNull(leads.deletedAt),
    inArray(leads.leadStatus, [...NA_STATUSES]),
    naLeadExpiredSql(cutoff),
  ];
  if (excludeIds.length > 0) {
    filters.push(notInArray(leads.id, excludeIds));
  }
  return db
    .select({ id: leads.id })
    .from(leads)
    .where(and(...filters))
    .limit(BATCH_SIZE);
}

/**
 * Hard-delete from the server database:
 * - NA leads (`not_interested` / `dropped`) that have been NA for ≥1 week
 * - Soft-deleted (Deleted) leads whose `deletedAt` is ≥48 hours ago
 *
 * Drains batches until empty or per-run caps. On API startup the job runs
 * immediately so NA leads already past 1 week are removed without waiting.
 */
export async function purgeExpiredLeads(now: Date = new Date()): Promise<PurgeExpiredLeadsResult> {
  const naCutoff = new Date(now.getTime() - NA_LEAD_PURGE_AFTER_MS);
  const softDeletedCutoff = new Date(now.getTime() - SOFT_DELETED_LEAD_PURGE_AFTER_MS);

  let softDeletedPurged = 0;
  let naPurged = 0;
  let checked = 0;
  let failed = 0;

  while (softDeletedPurged + failed < MAX_SOFT_DELETED_PURGE_PER_RUN) {
    const batch = await fetchSoftDeletedBatch(softDeletedCutoff);
    if (batch.length === 0) break;
    checked += batch.length;

    for (const row of batch) {
      try {
        if (await hardDeleteLead(row.id)) softDeletedPurged += 1;
      } catch (err) {
        failed += 1;
        logger.warn("Failed to purge soft-deleted lead", {
          leadId: row.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (batch.length < BATCH_SIZE) break;
  }

  const failedNaIds: string[] = [];
  while (naPurged + failed < MAX_NA_PURGE_PER_RUN) {
    const batch = await fetchNaBatch(naCutoff, failedNaIds);
    if (batch.length === 0) break;
    checked += batch.length;

    for (const row of batch) {
      try {
        if (await hardDeleteLead(row.id)) {
          naPurged += 1;
        } else {
          failed += 1;
          failedNaIds.push(row.id);
        }
      } catch (err) {
        failed += 1;
        failedNaIds.push(row.id);
        logger.warn("Failed to purge NA lead", {
          leadId: row.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (batch.length < BATCH_SIZE) break;
  }

  logger.info("Purged expired leads", {
    softDeletedPurged,
    naPurged,
    checked,
    failed,
    naCutoff: naCutoff.toISOString(),
    softDeletedCutoff: softDeletedCutoff.toISOString(),
  });

  return { naPurged, softDeletedPurged, checked, failed };
}
