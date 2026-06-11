import { adLeads, leadActivities, leads } from "@propninja/db";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";

export interface NormalizedAdLead {
  source: "facebook_ads" | "google_ads";
  externalLeadId: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  formId?: string;
  formName?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  city?: string;
  rawPayload: unknown;
}

type LeadRow = typeof leads.$inferSelect;

const LEAD_SOURCE_BY_PLATFORM: Record<NormalizedAdLead["source"], string> = {
  facebook_ads: "Facebook Ads",
  google_ads: "Google Ads",
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

function normalizePhone(phone?: string) {
  const trimmed = phone?.trim();
  return trimmed ? trimmed.replace(/\s+/g, "") : undefined;
}

function normalizeEmail(email?: string) {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || undefined;
}

function normalizeName(input: Pick<NormalizedAdLead, "firstName" | "lastName" | "fullName">) {
  let firstName = input.firstName?.trim() ?? "";
  let lastName = input.lastName?.trim() ?? "";

  if (!firstName && input.fullName?.trim()) {
    const parts = input.fullName.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ");
  }

  if (!firstName) {
    firstName = "Unknown";
  }

  return { firstName, lastName: lastName || "" };
}

function buildAdLeadTags(input: NormalizedAdLead) {
  const tags = ["ad_lead", input.source];
  if (input.campaignName?.trim()) {
    tags.push(input.campaignName.trim());
  }
  return tags;
}

function buildActivityMetadata(input: NormalizedAdLead, leadSource: string) {
  const campaignLabel = input.campaignName?.trim() || "Unknown campaign";

  return {
    kind: "ad_lead",
    text: `New ${leadSource} lead: ${campaignLabel}`,
    source: input.source,
    externalLeadId: input.externalLeadId,
    campaignId: input.campaignId ?? null,
    campaignName: input.campaignName ?? null,
    adsetId: input.adsetId ?? null,
    adsetName: input.adsetName ?? null,
    formId: input.formId ?? null,
    formName: input.formName ?? null,
    rawPayload: input.rawPayload,
  };
}

function resolveCreatePhone(input: NormalizedAdLead) {
  const phone = normalizePhone(input.phone);
  if (phone && phone.length >= 5) {
    return phone;
  }

  const fromExternal = `ad:${input.source}:${input.externalLeadId}`.slice(0, 50);
  if (fromExternal.length >= 5) {
    return fromExternal;
  }

  return `ad:${input.externalLeadId}`.padEnd(5, "0");
}

async function findLeadByAdLeadRecord(
  source: NormalizedAdLead["source"],
  externalLeadId: string,
): Promise<LeadRow | null> {
  const [row] = await db
    .select({ lead: leads })
    .from(adLeads)
    .innerJoin(leads, eq(adLeads.leadId, leads.id))
    .where(
      and(
        eq(adLeads.source, source),
        eq(adLeads.externalLeadId, externalLeadId),
        isNull(leads.deletedAt),
      ),
    )
    .limit(1);

  return row?.lead ?? null;
}

/** Legacy lookup for leads ingested before the ad_leads table existed. */
async function findLeadByExternalAdId(externalLeadId: string) {
  const [byCustomFields] = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
        or(
          sql`${leads.customFields}->'adLead'->>'externalLeadId' = ${externalLeadId}`,
          sql`${leads.customFields}->'lastAdLead'->>'externalLeadId' = ${externalLeadId}`,
        ),
      ),
    )
    .limit(1);

  if (byCustomFields) {
    return byCustomFields;
  }

  const [row] = await db
    .select({ lead: leads })
    .from(leadActivities)
    .innerJoin(leads, eq(leadActivities.leadId, leads.id))
    .where(
      and(
        eq(leadActivities.orgId, SINGLE_TENANT_ORG_ID),
        isNull(leads.deletedAt),
        sql`${leadActivities.metadata}->>'kind' = 'ad_lead'`,
        sql`${leadActivities.metadata}->>'externalLeadId' = ${externalLeadId}`,
      ),
    )
    .limit(1);

  return row?.lead ?? null;
}

async function findExistingActiveLead(phone?: string, email?: string) {
  const matchFilters = [];

  if (phone) {
    matchFilters.push(eq(leads.phone, phone));
  }
  if (email) {
    matchFilters.push(eq(leads.email, email));
  }

  if (matchFilters.length === 0) {
    return null;
  }

  const [row] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.orgId, SINGLE_TENANT_ORG_ID), isNull(leads.deletedAt), or(...matchFilters)))
    .limit(1);

  return row ?? null;
}

async function insertAdLeadActivity(leadId: string, metadata: Record<string, unknown>) {
  await db.insert(leadActivities).values({
    orgId: SINGLE_TENANT_ORG_ID,
    leadId,
    userId: null,
    type: "note",
    metadata,
  });
}

function mergeTags(existing: string[] | null | undefined, incoming: string[]) {
  return [...new Set([...(existing ?? []), ...incoming])];
}

function buildAdLeadCustomFields(
  input: NormalizedAdLead,
  existing?: Record<string, unknown> | null,
) {
  const adLeadPayload = {
    source: input.source,
    externalLeadId: input.externalLeadId,
    campaignId: input.campaignId ?? null,
    campaignName: input.campaignName ?? null,
    adsetId: input.adsetId ?? null,
    adsetName: input.adsetName ?? null,
    formId: input.formId ?? null,
    formName: input.formName ?? null,
    rawPayload: input.rawPayload,
  };

  const campaignName = input.campaignName ?? (existing?.campaignName as string | undefined) ?? null;

  return {
    ...(existing ?? {}),
    adLead: adLeadPayload,
    lastAdLead: {
      ...adLeadPayload,
      ingestedAt: new Date().toISOString(),
    },
    campaignName,
    /** Legacy key used by calls report campaign filter. */
    campaign: campaignName,
  };
}

async function recordAdLeadLink(
  input: NormalizedAdLead,
  leadId: string,
): Promise<"inserted" | "duplicate"> {
  try {
    await db.insert(adLeads).values({
      source: input.source,
      externalLeadId: input.externalLeadId,
      leadId,
      rawPayload:
        typeof input.rawPayload === "object" && input.rawPayload !== null
          ? (input.rawPayload as Record<string, unknown>)
          : { value: input.rawPayload },
    });
    return "inserted";
  } catch (error) {
    if (isUniqueViolation(error)) {
      logger.warn("Duplicate ad lead ingest attempt", {
        source: input.source,
        externalLeadId: input.externalLeadId,
        leadId,
      });
      return "duplicate";
    }
    throw error;
  }
}

async function resolveExistingAdLead(input: NormalizedAdLead): Promise<LeadRow | null> {
  const fromTable = await findLeadByAdLeadRecord(input.source, input.externalLeadId);
  if (fromTable) {
    logger.info("Ad lead ingest skipped — already recorded", {
      source: input.source,
      externalLeadId: input.externalLeadId,
      leadId: fromTable.id,
    });
    return fromTable;
  }

  const legacy = await findLeadByExternalAdId(input.externalLeadId);
  if (!legacy) {
    return null;
  }

  const linkResult = await recordAdLeadLink(input, legacy.id);
  if (linkResult === "duplicate") {
    return findLeadByAdLeadRecord(input.source, input.externalLeadId);
  }

  logger.info("Ad lead ingest skipped — backfilled legacy record", {
    source: input.source,
    externalLeadId: input.externalLeadId,
    leadId: legacy.id,
  });
  return legacy;
}

export const adLeadService = {
  async ingestAdLead(input: NormalizedAdLead): Promise<LeadRow> {
    const leadSource = LEAD_SOURCE_BY_PLATFORM[input.source];
    const { firstName, lastName } = normalizeName(input);
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    const tags = buildAdLeadTags(input);
    const activityMetadata = buildActivityMetadata(input, leadSource);

    const existingAdLead = await resolveExistingAdLead(input);
    if (existingAdLead) {
      return existingAdLead;
    }

    const existing = await findExistingActiveLead(phone, email);

    let leadRow: LeadRow;

    if (existing) {
      const [updated] = await db
        .update(leads)
        .set({
          firstName: firstName !== "Unknown" ? firstName : existing.firstName,
          lastName: lastName || existing.lastName,
          email: email ?? existing.email,
          city: input.city?.trim() || existing.city,
          leadSource,
          tags: mergeTags(existing.tags, tags),
          customFields: buildAdLeadCustomFields(input, existing.customFields),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, existing.id))
        .returning();

      leadRow = updated ?? existing;
    } else {
      const createPhone = resolveCreatePhone(input);

      const duplicatePhone = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.orgId, SINGLE_TENANT_ORG_ID),
            eq(leads.phone, createPhone),
            isNull(leads.deletedAt),
          ),
        )
        .limit(1);

      if (duplicatePhone.length > 0) {
        const matched = await db
          .select()
          .from(leads)
          .where(eq(leads.id, duplicatePhone[0]!.id))
          .limit(1);

        const lead = matched[0]!;
        const [updated] = await db
          .update(leads)
          .set({
            leadSource,
            tags: mergeTags(lead.tags, tags),
            customFields: buildAdLeadCustomFields(input, lead.customFields),
            updatedAt: new Date(),
          })
          .where(eq(leads.id, lead.id))
          .returning();

        leadRow = updated ?? lead;
      } else {
        const [created] = await db
          .insert(leads)
          .values({
            orgId: SINGLE_TENANT_ORG_ID,
            firstName,
            lastName,
            email: email ?? null,
            phone: createPhone,
            city: input.city?.trim() || null,
            leadSource,
            leadStatus: "new",
            tags,
            customFields: buildAdLeadCustomFields(input),
          })
          .returning();

        leadRow = created!;
      }
    }

    const linkResult = await recordAdLeadLink(input, leadRow.id);
    if (linkResult === "duplicate") {
      const duplicateLead = await findLeadByAdLeadRecord(input.source, input.externalLeadId);
      return duplicateLead ?? leadRow;
    }

    await insertAdLeadActivity(leadRow.id, activityMetadata);

    return leadRow;
  },
};
