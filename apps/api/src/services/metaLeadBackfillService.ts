/**
 * Pulls historical Meta Lead Ads from Graph (`/{form-id}/leads`) and runs them
 * through the same ingest path as webhooks. Used when live webhooks were missed.
 */
import { facebookForms, facebookLeads, facebookPages, facebookSyncHistory } from "@propninja/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { asMetaId } from "../lib/facebook.js";
import { logger } from "../lib/logger.js";
import { getFormLeads, getLeadForms } from "../lib/metaGraphClient.js";
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

type FormScanTarget = { formId: string; metaPageId: string };

async function loadDbForms(orgId: string, includeUnselected: boolean): Promise<FormScanTarget[]> {
  return db
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
}

async function loadGraphForms(
  orgId: string,
  includeUnselected: boolean,
): Promise<FormScanTarget[]> {
  const pages = await db
    .select({
      metaPageId: facebookPages.pageId,
    })
    .from(facebookPages)
    .where(
      and(
        eq(facebookPages.orgId, orgId),
        eq(facebookPages.isActive, true),
        isNotNull(facebookPages.accessTokenEncrypted),
        ...(includeUnselected ? [] : [eq(facebookPages.isSelected, true)]),
      ),
    );

  const forms: FormScanTarget[] = [];
  for (const page of pages) {
    const pageToken = await getPageAccessToken(orgId, page.metaPageId);
    if (!pageToken) continue;
    try {
      const graphForms = await getLeadForms(page.metaPageId, pageToken);
      for (const form of graphForms) {
        const formId = asMetaId(form.id);
        if (!formId) continue;
        forms.push({ formId, metaPageId: page.metaPageId });
      }
    } catch (error) {
      logger.warn("Meta lead backfill: listing Graph forms failed", {
        pageId: page.metaPageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return forms;
}

function uniqueForms(forms: FormScanTarget[]): FormScanTarget[] {
  const seen = new Set<string>();
  const unique: FormScanTarget[] = [];
  for (const form of forms) {
    const key = `${form.metaPageId}:${form.formId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(form);
  }
  return unique;
}

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

  const dbForms = await loadDbForms(orgId, includeUnselected);
  const graphForms = includeUnselected ? await loadGraphForms(orgId, includeUnselected) : [];
  const forms = uniqueForms([...dbForms, ...graphForms]);

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
      const leadgenId = asMetaId(graphLead.id);
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
        await processLeadgenWebhook(
          {
            leadgen_id: leadgenId,
            page_id: form.metaPageId,
            form_id: form.formId,
            ad_id: graphLead.ad_id,
            adgroup_id: graphLead.adset_id,
            campaign_id: graphLead.campaign_id,
            created_time: graphLead.created_time
              ? Math.floor(new Date(graphLead.created_time).getTime() / 1000)
              : undefined,
          },
          { orgId, via: includeUnselected ? "manual_pull" : "reconciliation" },
        );
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
