/**
 * Pulls historical Meta Lead Ads from Graph (`/{form-id}/leads`) and runs them
 * through the same ingest path as webhooks. Used when live webhooks were missed.
 */
import { facebookForms, facebookLeads, facebookPages, facebookSyncHistory } from "@propninja/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { getFormLeads } from "../lib/metaGraphClient.js";
import { processLeadgenWebhook } from "./metaLeadIngestService.js";
import { getPageAccessToken } from "./metaTokenService.js";

export type BackfillMetaLeadsResult = {
  formsScanned: number;
  leadsSeen: number;
  ingested: number;
  skipped: number;
  failed: number;
  errors: Array<{ formId: string; leadgenId?: string; error: string }>;
};

export async function backfillMetaLeads(
  orgId: string = SINGLE_TENANT_ORG_ID,
  options: {
    sinceDays?: number;
    /** Manual Pull leads: include forms/pages even if not selected in Settings. */
    includeUnselected?: boolean;
  } = {},
): Promise<BackfillMetaLeadsResult> {
  const sinceDays = Math.min(Math.max(options.sinceDays ?? 7, 1), 90);
  const sinceUnix = Math.floor(Date.now() / 1000) - sinceDays * 86400;
  const includeUnselected = options.includeUnselected === true;

  const forms = await db
    .select({
      formId: facebookForms.formId,
      metaPageId: facebookPages.pageId,
    })
    .from(facebookForms)
    .innerJoin(facebookPages, eq(facebookForms.pageId, facebookPages.id))
    .where(
      and(
        eq(facebookForms.orgId, orgId),
        eq(facebookForms.isActive, true),
        eq(facebookPages.isActive, true),
        isNotNull(facebookPages.accessTokenEncrypted),
        ...(includeUnselected
          ? []
          : [eq(facebookForms.isSelected, true), eq(facebookPages.isSelected, true)]),
      ),
    );

  const result: BackfillMetaLeadsResult = {
    formsScanned: 0,
    leadsSeen: 0,
    ingested: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const startedAt = new Date();

  for (const form of forms) {
    result.formsScanned += 1;
    const pageToken = await getPageAccessToken(orgId, form.metaPageId);
    if (!pageToken) {
      result.errors.push({ formId: form.formId, error: "Missing page access token" });
      continue;
    }

    let graphLeads: Awaited<ReturnType<typeof getFormLeads>> = [];
    try {
      graphLeads = await getFormLeads(form.formId, pageToken, { sinceUnix });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ formId: form.formId, error: message });
      logger.error("Meta lead backfill form list failed", {
        formId: form.formId,
        error: message,
      });
      continue;
    }

    for (const graphLead of graphLeads) {
      result.leadsSeen += 1;
      const leadgenId = graphLead.id;
      if (!leadgenId) {
        result.skipped += 1;
        continue;
      }

      const [existing] = await db
        .select({ id: facebookLeads.id })
        .from(facebookLeads)
        .where(and(eq(facebookLeads.orgId, orgId), eq(facebookLeads.leadgenId, leadgenId)))
        .limit(1);

      if (existing) {
        result.skipped += 1;
        continue;
      }

      try {
        await processLeadgenWebhook({
          leadgen_id: leadgenId,
          page_id: form.metaPageId,
          form_id: form.formId,
          ad_id: graphLead.ad_id,
          adgroup_id: graphLead.adset_id,
          campaign_id: graphLead.campaign_id,
          created_time: graphLead.created_time
            ? Math.floor(new Date(graphLead.created_time).getTime() / 1000)
            : undefined,
        });
        result.ingested += 1;
      } catch (error) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push({ formId: form.formId, leadgenId, error: message });
        logger.error("Meta lead backfill ingest failed", {
          formId: form.formId,
          leadgenId,
          error: message,
        });
      }
    }
  }

  await db.insert(facebookSyncHistory).values({
    orgId,
    syncType: "leads_backfill",
    status:
      result.failed > 0 && result.ingested === 0
        ? "failed"
        : result.failed > 0
          ? "partial"
          : "success",
    startedAt,
    finishedAt: new Date(),
    recordsProcessed: result.ingested,
    recordsFailed: result.failed,
    errorMessage: result.errors[0]?.error ?? null,
    metadata: {
      sinceDays,
      includeUnselected,
      formsScanned: result.formsScanned,
      leadsSeen: result.leadsSeen,
      skipped: result.skipped,
      failed: result.failed,
      errorCount: result.errors.length,
    },
  });

  logger.info("Meta lead backfill finished", {
    orgId,
    formsScanned: result.formsScanned,
    leadsSeen: result.leadsSeen,
    ingested: result.ingested,
    skipped: result.skipped,
    failed: result.failed,
  });

  return result;
}
