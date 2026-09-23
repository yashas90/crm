/**
 * Pulls historical Meta Lead Ads from Graph (`/{form-id}/leads`) and runs them
 * through the same ingest path as webhooks. Used when live webhooks were missed.
 */
import { facebookForms, facebookLeads, facebookPages, facebookSyncHistory } from "@propninja/db";
import { and, eq, isNotNull, lt } from "drizzle-orm";
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
    /**
     * List forms from Graph in addition to rows already stored.
     * Defaults to `includeUnselected` so manual pulls still discover new forms.
     * The fast continuity loop turns this off to stay within Graph rate limits.
     */
    discoverFormsFromGraph?: boolean;
    /** Cap pages of `/{form-id}/leads` (100 leads each). Default 20. */
    maxPages?: number;
    /** `leads_backfill` for manual pulls; `leads_continuity` for the always-on loop. */
    syncType?: "leads_backfill" | "leads_continuity";
  } = {},
): Promise<BackfillMetaLeadsResult> {
  const sinceDays = Math.min(Math.max(options.sinceDays ?? 7, 1), 90);
  const sinceUnix = Math.floor(Date.now() / 1000) - sinceDays * 86400;
  const includeUnselected = options.includeUnselected === true;
  const syncType = options.syncType ?? "leads_backfill";
  const via =
    syncType === "leads_continuity" || !includeUnselected ? "reconciliation" : "manual_pull";

  const discoverFormsFromGraph = options.discoverFormsFromGraph ?? includeUnselected;
  const dbForms = await loadDbForms(orgId, includeUnselected);
  const graphForms = discoverFormsFromGraph ? await loadGraphForms(orgId, includeUnselected) : [];
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

  try {
    for (const form of forms) {
      result.formsScanned += 1;
      const pageToken = await getPageAccessToken(orgId, form.metaPageId);
      if (!pageToken) {
        result.failed += 1;
        result.errors.push({ formId: form.formId, error: "Missing page access token" });
        continue;
      }

      let graphLeads: Awaited<ReturnType<typeof getFormLeads>> = [];
      try {
        graphLeads = await getFormLeads(form.formId, pageToken, {
          sinceUnix,
          maxPages: options.maxPages,
        });
      } catch (error) {
        result.failed += 1;
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
            { orgId, via },
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
  } catch (error) {
    result.failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push({ formId: "*", error: message });
    logger.error("Meta lead backfill aborted", { orgId, syncType, error: message });
  }

  const status =
    result.failed === 0
      ? "success"
      : result.ingested > 0 || result.formsScanned > result.failed
        ? "partial"
        : "failed";

  await db.insert(facebookSyncHistory).values({
    orgId,
    syncType,
    status,
    startedAt,
    finishedAt: new Date(),
    recordsProcessed: result.ingested,
    recordsFailed: result.failed,
    errorMessage: result.errors[0]?.error ?? null,
    metadata: {
      sinceDays,
      includeUnselected,
      discoverFormsFromGraph,
      formsScanned: result.formsScanned,
      leadsSeen: result.leadsSeen,
      skipped: result.skipped,
      failed: result.failed,
      errorCount: result.errors.length,
    },
  });

  if (syncType === "leads_continuity") {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    try {
      await db
        .delete(facebookSyncHistory)
        .where(
          and(
            eq(facebookSyncHistory.orgId, orgId),
            eq(facebookSyncHistory.syncType, "leads_continuity"),
            lt(facebookSyncHistory.startedAt, cutoff),
          ),
        );
    } catch (error) {
      logger.warn("Failed to prune old Meta lead continuity history", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Meta lead backfill finished", {
    orgId,
    syncType,
    formsScanned: result.formsScanned,
    leadsSeen: result.leadsSeen,
    ingested: result.ingested,
    skipped: result.skipped,
    failed: result.failed,
  });

  return result;
}
