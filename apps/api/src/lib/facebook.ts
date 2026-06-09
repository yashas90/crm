import { createHmac, timingSafeEqual } from "node:crypto";
import type { NormalizedAdLead } from "../services/adLeadService.js";
import { env } from "./env.js";

const GRAPH_API_VERSION = "v21.0";

export type FacebookFieldData = {
  name: string;
  values: string[];
};

export type FacebookLeadDetails = {
  id?: string;
  created_time?: string;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
  field_data?: FacebookFieldData[];
  [key: string]: unknown;
};

export type MetaLeadgenWebhookValue = {
  leadgen_id: string;
  page_id: string;
  form_id?: string;
  ad_id?: string;
  adgroup_id?: string;
  campaign_id?: string;
  created_time?: number;
};

export type MetaLeadgenWebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{
      field?: string;
      value?: MetaLeadgenWebhookValue;
    }>;
  }>;
};

function getFieldValue(fieldData: FacebookFieldData[] | undefined, ...names: string[]) {
  if (!fieldData?.length) return undefined;

  const normalized = new Map(
    fieldData.map((field) => [field.name.trim().toLowerCase(), field.values?.[0]?.trim()]),
  );

  for (const name of names) {
    const value = normalized.get(name.toLowerCase());
    if (value) return value;
  }

  return undefined;
}

async function fetchGraphObjectName(objectId: string): Promise<string | undefined> {
  const accessToken = env.PAGE_ACCESS_TOKEN;
  if (!accessToken || !objectId.trim()) {
    return undefined;
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${objectId}`);
  url.searchParams.set("fields", "name");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  if (!response.ok) {
    return undefined;
  }

  const json = (await response.json()) as { name?: string };
  return json.name?.trim() || undefined;
}

/** Resolve human-readable campaign / ad set / form names from Graph object IDs. */
export async function enrichFacebookAdLeadMetadata(
  lead: NormalizedAdLead,
): Promise<NormalizedAdLead> {
  const [campaignName, adsetName, formName] = await Promise.all([
    lead.campaignId ? fetchGraphObjectName(lead.campaignId) : undefined,
    lead.adsetId ? fetchGraphObjectName(lead.adsetId) : undefined,
    lead.formId ? fetchGraphObjectName(lead.formId) : undefined,
  ]);

  return {
    ...lead,
    campaignName: campaignName ?? lead.campaignName,
    adsetName: adsetName ?? lead.adsetName,
    formName: formName ?? lead.formName,
  };
}

export async function getLeadDetails(leadId: string): Promise<FacebookLeadDetails> {
  const accessToken = env.PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("PAGE_ACCESS_TOKEN is not configured");
  }

  const fields = [
    "id",
    "created_time",
    "ad_id",
    "adset_id",
    "campaign_id",
    "form_id",
    "field_data",
  ].join(",");

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${leadId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Facebook Graph API error (${response.status}): ${body}`);
  }

  return (await response.json()) as FacebookLeadDetails;
}

export function mapFacebookLeadToNormalizedAdLead(
  leadgenId: string,
  leadDetails: FacebookLeadDetails,
  context: MetaLeadgenWebhookValue,
): NormalizedAdLead {
  const fieldData = leadDetails.field_data;

  return {
    source: "facebook_ads",
    externalLeadId: leadgenId,
    campaignId: context.campaign_id ?? leadDetails.campaign_id,
    adsetId: context.adgroup_id ?? leadDetails.adset_id,
    formId: context.form_id ?? leadDetails.form_id,
    firstName: getFieldValue(fieldData, "first_name"),
    lastName: getFieldValue(fieldData, "last_name"),
    fullName: getFieldValue(fieldData, "full_name", "name"),
    email: getFieldValue(fieldData, "email", "email_address"),
    phone: getFieldValue(fieldData, "phone_number", "phone", "mobile_number"),
    city: getFieldValue(fieldData, "city"),
    rawPayload: {
      webhook: context,
      graph: leadDetails,
    },
  };
}

export function extractLeadgenChanges(body: MetaLeadgenWebhookBody): MetaLeadgenWebhookValue[] {
  const changes: MetaLeadgenWebhookValue[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen" || !change.value?.leadgen_id) {
        continue;
      }
      changes.push(change.value);
    }
  }

  return changes;
}

/**
 * Verifies Meta webhook `X-Hub-Signature-256` header (HMAC-SHA256 of raw body).
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signatureHeader.slice("sha256=".length);
  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  try {
    const received = Buffer.from(receivedHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    if (received.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}
