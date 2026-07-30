/**
 * DB-driven Meta lead ingest pipeline (multi-page/multi-form aware), used by:
 *  - the BullMQ `META_LEAD_INGEST` worker (see `lib/jobQueue.ts`), and
 *  - `routes/integrationsMeta.ts` for webhook dedupe recording before enqueue.
 *
 * Legacy single-page webhook processing (`routes/integrationsMeta.ts`'s
 * `processMetaLeadWebhook`) remains the fallback path when Redis/BullMQ is
 * unavailable and continues to use `lib/facebook.ts` + `adLeadService` directly.
 */
import {
  facebookForms,
  facebookLeads,
  facebookPages,
  facebookWebhooks,
  leads,
  users,
} from "@propninja/db";
import { and, eq, sql } from "drizzle-orm";
import { notifyNewAdLeadReceived } from "../lib/adLeadNotifications.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import type { MetaLeadgenWebhookValue } from "../lib/facebook.js";
import { mapFacebookLeadToNormalizedAdLead } from "../lib/facebook.js";
import { logger } from "../lib/logger.js";
import { type GraphLeadDetails, getLeadDetails } from "../lib/metaGraphClient.js";
import { publishMetaLiveLead } from "../lib/metaRealtimeBus.js";
import { autoAssignLead } from "../routes/assignmentRules.js";
import { adLeadService } from "./adLeadService.js";
import { enqueueConversionForLeadStatusChange } from "./metaConversionService.js";
import { pickMetaFormAssignee } from "./metaFormAssignment.js";
import { getPageAccessToken } from "./metaTokenService.js";
import { taskService } from "./taskService.js";

function dedupeKeyFor(change: MetaLeadgenWebhookValue): string {
  return `leadgen:${change.leadgen_id}`;
}

export type WebhookDedupeResult = { webhookId: string | null; alreadyProcessed: boolean };

/** Idempotently records a leadgen webhook delivery; used before enqueueing so retried Meta deliveries are skipped. */
export async function recordWebhookDedupe(
  change: MetaLeadgenWebhookValue,
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<WebhookDedupeResult> {
  const dedupeKey = dedupeKeyFor(change);

  const [inserted] = await db
    .insert(facebookWebhooks)
    .values({
      orgId,
      metaPageId: change.page_id,
      eventType: "leadgen",
      externalEventId: change.leadgen_id,
      dedupeKey,
      payload: change as unknown as Record<string, unknown>,
      status: "queued",
    })
    .onConflictDoNothing({ target: [facebookWebhooks.orgId, facebookWebhooks.dedupeKey] })
    .returning({ id: facebookWebhooks.id });

  if (inserted) {
    return { webhookId: inserted.id, alreadyProcessed: false };
  }

  const [existing] = await db
    .select({ id: facebookWebhooks.id, status: facebookWebhooks.status })
    .from(facebookWebhooks)
    .where(and(eq(facebookWebhooks.orgId, orgId), eq(facebookWebhooks.dedupeKey, dedupeKey)))
    .limit(1);

  return {
    webhookId: existing?.id ?? null,
    alreadyProcessed: existing?.status === "processed" || existing?.status === "duplicate",
  };
}

async function resolveProjectId(
  change: MetaLeadgenWebhookValue,
  orgId: string,
): Promise<string | null> {
  if (change.form_id) {
    const [form] = await db
      .select({ projectId: facebookForms.projectId })
      .from(facebookForms)
      .where(and(eq(facebookForms.orgId, orgId), eq(facebookForms.formId, change.form_id)))
      .limit(1);
    if (form?.projectId) return form.projectId;
  }

  const [page] = await db
    .select({ projectId: facebookPages.projectId })
    .from(facebookPages)
    .where(and(eq(facebookPages.orgId, orgId), eq(facebookPages.pageId, change.page_id)))
    .limit(1);

  return page?.projectId ?? null;
}

function fieldValue(fieldData: GraphLeadDetails["field_data"], ...names: string[]) {
  if (!fieldData?.length) return undefined;
  const normalized = new Map(
    fieldData.map((f) => [f.name.trim().toLowerCase(), f.values?.[0]?.trim()]),
  );
  for (const name of names) {
    const value = normalized.get(name.toLowerCase());
    if (value) return value;
  }
  return undefined;
}

async function upsertFacebookLeadMirror(
  orgId: string,
  change: MetaLeadgenWebhookValue,
  leadDetails: GraphLeadDetails,
  crmLeadId: string,
) {
  const fieldData = leadDetails.field_data ?? [];

  await db
    .insert(facebookLeads)
    .values({
      orgId,
      leadId: crmLeadId,
      leadgenId: change.leadgen_id,
      pageId: change.page_id,
      formId: change.form_id ?? leadDetails.form_id ?? null,
      campaignId: change.campaign_id ?? leadDetails.campaign_id ?? null,
      adsetId: change.adgroup_id ?? leadDetails.adset_id ?? null,
      adId: change.ad_id ?? leadDetails.ad_id ?? null,
      fullName: fieldValue(fieldData, "full_name", "name"),
      email: fieldValue(fieldData, "email", "email_address"),
      phone: fieldValue(fieldData, "phone_number", "phone", "mobile_number"),
      city: fieldValue(fieldData, "city"),
      state: fieldValue(fieldData, "state"),
      country: fieldValue(fieldData, "country"),
      zip: fieldValue(fieldData, "zip", "post_code", "zip_code"),
      fieldData: { field_data: fieldData },
      rawPayload: { webhook: change, graph: leadDetails },
      createdTime: leadDetails.created_time ? new Date(leadDetails.created_time) : null,
    })
    .onConflictDoUpdate({
      target: [facebookLeads.orgId, facebookLeads.leadgenId],
      set: { leadId: crmLeadId },
    });
}

export type ProcessLeadgenOptions = {
  orgId?: string;
  webhookId?: string | null;
  via?: "webhook" | "reconciliation" | "manual_pull";
};

export type MetaLeadIngestJobPayload = {
  change: MetaLeadgenWebhookValue;
  orgId?: string;
  webhookId?: string | null;
};

/**
 * Full DB-driven ingest for a single `leadgen` webhook change: resolves the
 * page access token from `facebook_pages`, fetches lead details from Graph,
 * ingests the CRM lead (dedup by phone/email via `adLeadService`), mirrors the
 * raw Meta lead into `facebook_leads`, auto-assigns if unassigned, and enqueues
 * an initial "Lead" CAPI conversion event.
 */
export async function processLeadgenWebhook(
  change: MetaLeadgenWebhookValue,
  options: ProcessLeadgenOptions = {},
): Promise<void> {
  const orgId = options.orgId ?? SINGLE_TENANT_ORG_ID;
  const via = options.via ?? "webhook";
  const record = options.webhookId
    ? { webhookId: options.webhookId, alreadyProcessed: false }
    : await recordWebhookDedupe(change, orgId);

  if (record.alreadyProcessed) {
    logger.info("Meta leadgen webhook already processed — skipping", {
      leadgenId: change.leadgen_id,
    });
    return;
  }

  if (record.webhookId) {
    await db
      .update(facebookWebhooks)
      .set({ status: "processing" })
      .where(eq(facebookWebhooks.id, record.webhookId));
  }

  try {
    const pageAccessToken = await getPageAccessToken(orgId, change.page_id);
    if (!pageAccessToken) {
      throw new Error(`No page access token available for page ${change.page_id}`);
    }

    const leadDetails = await getLeadDetails(change.leadgen_id, pageAccessToken);
    const normalized = mapFacebookLeadToNormalizedAdLead(change.leadgen_id, leadDetails, change);
    const projectId = await resolveProjectId(change, orgId);

    const lead = await adLeadService.ingestAdLead(normalized, { skipNotification: true });

    if (projectId && !lead.projectId) {
      await db.update(leads).set({ projectId }).where(eq(leads.id, lead.id));
    }

    await upsertFacebookLeadMirror(orgId, change, leadDetails, lead.id);

    let assigneeId = lead.assignedTo;
    if (!assigneeId) {
      try {
        const formAssigneeId = await pickMetaFormAssignee(orgId, change.form_id);
        assigneeId =
          formAssigneeId ??
          (await autoAssignLead(db, {
            leadSource: lead.leadSource,
            city: lead.city,
            zone: lead.zone,
          }));
        if (assigneeId) {
          await db.update(leads).set({ assignedTo: assigneeId }).where(eq(leads.id, lead.id));
        }
      } catch (error) {
        logger.error("Meta lead auto-assign failed", {
          leadId: lead.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Do not set nextFollowupAt here — that field is reserved for agent-scheduled
    // Call Back / Site Visit. Auto-dating it made untouched New leads show as Overdue.
    const followUpAt = new Date(Date.now() + 60 * 60 * 1000);

    if (assigneeId) {
      void taskService
        .create({
          title: `Follow up Meta lead: ${lead.firstName}`.slice(0, 120),
          description: "Auto-created after Meta Lead Ads ingest",
          dueAt: followUpAt.toISOString(),
          taskType: "follow_up",
          priority: "high",
          leadId: lead.id,
          assignedTo: assigneeId,
          createdBy: assigneeId,
        })
        .catch((error) => {
          logger.warn("Meta lead follow-up task create failed", {
            leadId: lead.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }

    void notifyNewAdLeadReceived(
      db,
      { ...lead, assignedTo: assigneeId },
      {
        source: "facebook_ads",
        campaignName: normalized.campaignName,
      },
    ).catch((error) => {
      logger.error("Failed to notify Meta lead recipients", {
        leadId: lead.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    const [mirror] = await db
      .select({
        fullName: facebookLeads.fullName,
        phone: facebookLeads.phone,
        email: facebookLeads.email,
        campaignName: facebookLeads.campaignName,
        adName: facebookLeads.adName,
        adsetName: facebookLeads.adsetName,
        formName: facebookLeads.formName,
        pageName: facebookLeads.pageName,
        createdTime: facebookLeads.createdTime,
        ingestedAt: facebookLeads.ingestedAt,
      })
      .from(facebookLeads)
      .where(and(eq(facebookLeads.orgId, orgId), eq(facebookLeads.leadgenId, change.leadgen_id)))
      .limit(1);

    let assignedName: string | null = null;
    if (assigneeId) {
      const [agent] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, assigneeId))
        .limit(1);
      assignedName = agent?.name ?? null;
    }

    publishMetaLiveLead({
      type: "meta_lead_ingested",
      at: new Date().toISOString(),
      leadId: lead.id,
      leadgenId: change.leadgen_id,
      fullName: mirror?.fullName ?? `${lead.firstName} ${lead.lastName ?? ""}`.trim(),
      phone: mirror?.phone ?? lead.phone,
      email: mirror?.email ?? lead.email,
      assignedTo: assigneeId,
      assignedName,
      projectName: lead.projectName,
      campaignName: mirror?.campaignName ?? normalized.campaignName ?? null,
      adName: mirror?.adName ?? null,
      adsetName: mirror?.adsetName ?? null,
      formName: mirror?.formName ?? null,
      pageName: mirror?.pageName ?? null,
      source: lead.leadSource ?? "Meta Ads",
      leadStatus: lead.leadStatus,
      createdTime: mirror?.createdTime?.toISOString() ?? null,
      ingestedAt: (mirror?.ingestedAt ?? new Date()).toISOString(),
      via,
    });

    void enqueueConversionForLeadStatusChange(lead.id, lead.leadStatus).catch((error) => {
      logger.error("Failed to enqueue Meta CAPI event for ingested lead", {
        leadId: lead.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    if (record.webhookId) {
      await db
        .update(facebookWebhooks)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(facebookWebhooks.id, record.webhookId));
    }

    logger.info("Meta lead ingested (DB-driven pipeline)", {
      leadgenId: change.leadgen_id,
      leadId: lead.id,
      pageId: change.page_id,
      via,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Meta leadgen webhook processing failed", {
      leadgenId: change.leadgen_id,
      pageId: change.page_id,
      error: message,
    });

    if (record.webhookId) {
      await db
        .update(facebookWebhooks)
        .set({
          status: "failed",
          errorMessage: message,
          retryCount: sql`${facebookWebhooks.retryCount} + 1`,
        })
        .where(eq(facebookWebhooks.id, record.webhookId));
    }

    throw error;
  }
}
