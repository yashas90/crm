import { env } from "./env.js";

const GOOGLE_ADS_API_VERSION = "v18";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleAdsLeadSubmission = {
  externalLeadId: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  formId?: string;
  formName?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  submittedAt?: string;
  rawPayload: unknown;
};

type GoogleAdsSubmissionField = {
  fieldType?: string;
  fieldValue?: string;
};

type GoogleAdsSearchRow = {
  leadFormSubmissionData?: {
    resourceName?: string;
    id?: string;
    submissionDateTime?: string;
    asset?: string;
    leadFormSubmissionFields?: GoogleAdsSubmissionField[];
  };
  asset?: {
    resourceName?: string;
    name?: string;
    leadFormAsset?: {
      businessName?: string;
      headline?: string;
    };
  };
  campaign?: {
    id?: string;
    name?: string;
  };
  adGroup?: {
    id?: string;
    name?: string;
  };
};

type GoogleAdsSearchResponse = {
  results?: GoogleAdsSearchRow[];
  nextPageToken?: string;
};

export function isGoogleAdsConfigured() {
  return Boolean(
    env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      env.GOOGLE_ADS_CLIENT_ID &&
      env.GOOGLE_ADS_CLIENT_SECRET &&
      env.GOOGLE_ADS_REFRESH_TOKEN &&
      env.GOOGLE_ADS_CUSTOMER_ID,
  );
}

function normalizeCustomerId(customerId: string) {
  return customerId.replace(/-/g, "");
}

function formatGoogleAdsDateTime(date: Date) {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function parseAssetId(assetResourceName?: string) {
  if (!assetResourceName) return undefined;
  const parts = assetResourceName.split("/");
  return parts[parts.length - 1];
}

function getSubmissionFieldValue(
  fields: GoogleAdsSubmissionField[] | undefined,
  ...fieldTypes: string[]
) {
  if (!fields?.length) return undefined;

  const lookup = new Map(
    fields.map((field) => [field.fieldType?.toUpperCase() ?? "", field.fieldValue?.trim()]),
  );

  for (const fieldType of fieldTypes) {
    const value = lookup.get(fieldType.toUpperCase());
    if (value) return value;
  }

  return undefined;
}

export function mapGoogleAdsSearchRow(row: GoogleAdsSearchRow): GoogleAdsLeadSubmission | null {
  const submission = row.leadFormSubmissionData;
  if (!submission) return null;

  const fields = submission.leadFormSubmissionFields;
  const externalLeadId =
    submission.id ?? submission.resourceName?.split("/").pop() ?? submission.resourceName;

  if (!externalLeadId) return null;

  const formName =
    row.asset?.name?.trim() ||
    row.asset?.leadFormAsset?.businessName?.trim() ||
    row.asset?.leadFormAsset?.headline?.trim() ||
    undefined;

  return {
    externalLeadId,
    campaignId: row.campaign?.id,
    campaignName: row.campaign?.name,
    adsetId: row.adGroup?.id,
    adsetName: row.adGroup?.name,
    formId: parseAssetId(submission.asset ?? row.asset?.resourceName),
    formName,
    fullName: getSubmissionFieldValue(fields, "FULL_NAME"),
    firstName: getSubmissionFieldValue(fields, "FIRST_NAME"),
    lastName: getSubmissionFieldValue(fields, "LAST_NAME"),
    email: getSubmissionFieldValue(fields, "EMAIL"),
    phone: getSubmissionFieldValue(fields, "PHONE_NUMBER", "PHONE"),
    city: getSubmissionFieldValue(fields, "CITY"),
    submittedAt: submission.submissionDateTime,
    rawPayload: row,
  };
}

async function fetchAccessToken() {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google OAuth token refresh failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Google OAuth token refresh returned no access_token");
  }

  return json.access_token;
}

async function searchGoogleAds(query: string, accessToken: string) {
  const customerId = normalizeCustomerId(env.GOOGLE_ADS_CUSTOMER_ID!);
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "Content-Type": "application/json",
  };

  if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers["login-customer-id"] = normalizeCustomerId(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  }

  const results: GoogleAdsSearchRow[] = [];
  let pageToken: string | undefined;

  do {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        pageToken,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google Ads API search failed (${response.status}): ${body}`);
    }

    const json = (await response.json()) as GoogleAdsSearchResponse;
    results.push(...(json.results ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);

  return results;
}

/**
 * Fetches lead form submissions since `since` using GAQL against lead_form_submission_data.
 */
export async function fetchLeadFormSubmissions(since: Date): Promise<GoogleAdsLeadSubmission[]> {
  if (!isGoogleAdsConfigured()) {
    throw new Error("Google Ads credentials are not fully configured");
  }

  const sinceClause = formatGoogleAdsDateTime(since);
  const query = `
    SELECT
      lead_form_submission_data.resource_name,
      lead_form_submission_data.id,
      lead_form_submission_data.submission_date_time,
      lead_form_submission_data.lead_form_submission_fields,
      lead_form_submission_data.asset,
      asset.resource_name,
      asset.name,
      asset.lead_form_asset.business_name,
      asset.lead_form_asset.headline,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name
    FROM lead_form_submission_data
    WHERE lead_form_submission_data.submission_date_time >= '${sinceClause}'
    ORDER BY lead_form_submission_data.submission_date_time DESC
  `
    .trim()
    .replace(/\s+/g, " ");

  const accessToken = await fetchAccessToken();
  const rows = await searchGoogleAds(query, accessToken);

  return rows
    .map((row) => mapGoogleAdsSearchRow(row))
    .filter((row): row is GoogleAdsLeadSubmission => row !== null);
}
