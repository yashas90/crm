import { leadActivities, leads } from "@propninja/db";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";

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

export const adLeadService = {
  async ingestAdLead(input: NormalizedAdLead): Promise<LeadRow> {
    const leadSource = LEAD_SOURCE_BY_PLATFORM[input.source];
    const { firstName, lastName } = normalizeName(input);
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    const tags = buildAdLeadTags(input);
    const activityMetadata = buildActivityMetadata(input, leadSource);

    const existingByExternalId = await findLeadByExternalAdId(input.externalLeadId);
    if (existingByExternalId) {
      return existingByExternalId;
    }

    const existing = await findExistingActiveLead(phone, email);

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

      await insertAdLeadActivity(existing.id, activityMetadata);

      return updated ?? existing;
    }

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

      await insertAdLeadActivity(lead.id, activityMetadata);
      return updated ?? lead;
    }

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

    await insertAdLeadActivity(created!.id, activityMetadata);

    return created!;
  },
};
