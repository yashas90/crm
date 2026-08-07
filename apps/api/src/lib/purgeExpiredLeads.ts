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
import { and, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";
import { logger } from "./logger.js";

/** Soft-deleted and NA leads older than this are hard-deleted from the database. */
export const LEAD_PURGE_AFTER_MS = 48 * 60 * 60 * 1000;

const NA_STATUSES = ["not_interested", "dropped"] as const;

const BATCH_SIZE = 200;
/** Safety cap per job tick so one run cannot block the event loop forever. */
const MAX_PER_RUN = 5000;

/**
 * When the lead last became NA (status_change → not_interested/dropped).
 * Falls back to createdAt when no status activity exists (legacy rows).
 * Must NOT use updatedAt — scoring / unassign jobs refresh that continuously.
 */
function naStatusSinceSql() {
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

async function fetchNaBatch(cutoff: Date) {
  return db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
        inArray(leads.leadStatus, [...NA_STATUSES]),
        sql`${naStatusSinceSql()} <= ${cutoff}`,
      ),
    )
    .limit(BATCH_SIZE);
}

/**
 * Hard-delete from the server database:
 * - NA leads (`not_interested` / `dropped`) that have been NA for ≥48 hours
 * - Soft-deleted (Deleted) leads whose `deletedAt` is ≥48 hours ago
 *
 * Drains batches until empty or MAX_PER_RUN so large NA pools clear quickly.
 */
export async function purgeExpiredLeads(now: Date = new Date()): Promise<PurgeExpiredLeadsResult> {
  const cutoff = new Date(now.getTime() - LEAD_PURGE_AFTER_MS);

  let softDeletedPurged = 0;
  let naPurged = 0;
  let checked = 0;
  let failed = 0;

  // Soft-deleted first
  while (softDeletedPurged + naPurged + failed < MAX_PER_RUN) {
    const batch = await fetchSoftDeletedBatch(cutoff);
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

  // NA leads
  while (softDeletedPurged + naPurged + failed < MAX_PER_RUN) {
    const batch = await fetchNaBatch(cutoff);
    if (batch.length === 0) break;
    checked += batch.length;

    for (const row of batch) {
      try {
        if (await hardDeleteLead(row.id)) naPurged += 1;
      } catch (err) {
        failed += 1;
        logger.warn("Failed to purge NA lead", {
          leadId: row.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (batch.length < BATCH_SIZE) break;
  }

  if (softDeletedPurged > 0 || naPurged > 0 || failed > 0) {
    logger.info("Purged expired leads", {
      softDeletedPurged,
      naPurged,
      checked,
      failed,
      cutoff: cutoff.toISOString(),
    });
  }

  return { naPurged, softDeletedPurged, checked, failed };
}
