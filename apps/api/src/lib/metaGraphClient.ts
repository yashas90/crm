/**
 * Thin wrapper around the Meta (Facebook) Graph API used by the Meta Business
 * Integration (OAuth sync, Graph reads, lead detail fetch, token exchange).
 *
 * Unlike `lib/facebook.ts` (legacy single-page/env-token webhook path), every
 * function here is token-parameterized so callers can pass a page/user/system
 * access token resolved per-org from the database (see `metaTokenService.ts`).
 */
import { env } from "./env.js";
import { logger } from "./logger.js";

export const GRAPH_API_VERSION = env.META_GRAPH_API_VERSION?.trim() || "v21.0";
const GRAPH_BASE_URL = "https://graph.facebook.com";
const OAUTH_BASE_URL = "https://www.facebook.com";

export type GraphUsageHeader = {
  type: "app" | "page" | "ad_account" | "business";
  callCount?: number;
  totalCpuTime?: number;
  totalTime?: number;
  estimatedTimeToRegainAccess?: number;
  key?: string;
};

export class MetaGraphApiError extends Error {
  status: number;
  code?: number;
  errorSubcode?: number;
  fbtraceId?: string;
  type?: string;

  constructor(
    status: number,
    message: string,
    details?: { code?: number; errorSubcode?: number; fbtraceId?: string; type?: string },
  ) {
    super(message);
    this.name = "MetaGraphApiError";
    this.status = status;
    this.code = details?.code;
    this.errorSubcode = details?.errorSubcode;
    this.fbtraceId = details?.fbtraceId;
    this.type = details?.type;
  }
}

type GraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

/** Parses `x-app-usage` / `x-business-use-case-usage` / `x-ad-account-usage` / `x-page-usage` headers. */
export function parseGraphUsageHeaders(headers: Headers): GraphUsageHeader[] {
  const usages: GraphUsageHeader[] = [];

  const appUsage = headers.get("x-app-usage");
  if (appUsage) {
    try {
      const parsed = JSON.parse(appUsage) as {
        call_count?: number;
        total_cputime?: number;
        total_time?: number;
      };
      usages.push({
        type: "app",
        callCount: parsed.call_count,
        totalCpuTime: parsed.total_cputime,
        totalTime: parsed.total_time,
      });
    } catch {
      // ignore malformed header
    }
  }

  const pageUsage = headers.get("x-page-usage");
  if (pageUsage) {
    try {
      const parsed = JSON.parse(pageUsage) as { call_count?: number; total_time?: number };
      usages.push({ type: "page", callCount: parsed.call_count, totalTime: parsed.total_time });
    } catch {
      // ignore malformed header
    }
  }

  const adAccountUsage = headers.get("x-ad-account-usage");
  if (adAccountUsage) {
    try {
      const parsed = JSON.parse(adAccountUsage) as {
        acc_id_util_pct?: number;
        reset_time_duration?: number;
      };
      usages.push({
        type: "ad_account",
        callCount: parsed.acc_id_util_pct,
        estimatedTimeToRegainAccess: parsed.reset_time_duration,
      });
    } catch {
      // ignore malformed header
    }
  }

  const businessUsage = headers.get("x-business-use-case-usage");
  if (businessUsage) {
    try {
      const parsed = JSON.parse(businessUsage) as Record<
        string,
        Array<{ call_count?: number; estimated_time_to_regain_access?: number }>
      >;
      for (const [key, entries] of Object.entries(parsed)) {
        const entry = entries[0];
        if (!entry) continue;
        usages.push({
          type: "business",
          key,
          callCount: entry.call_count,
          estimatedTimeToRegainAccess: entry.estimated_time_to_regain_access,
        });
      }
    } catch {
      // ignore malformed header
    }
  }

  return usages;
}

function logRateLimits(path: string, usages: GraphUsageHeader[]) {
  for (const usage of usages) {
    const nearLimit = (usage.callCount ?? 0) >= 90;
    if (nearLimit) {
      logger.warn("Meta Graph API rate limit near threshold", { path, ...usage });
    }
  }
}

async function parseGraphError(response: Response): Promise<MetaGraphApiError> {
  let body: GraphErrorBody = {};
  try {
    body = (await response.json()) as GraphErrorBody;
  } catch {
    // non-JSON error body
  }
  const message = body.error?.message ?? `Graph API error (${response.status})`;
  return new MetaGraphApiError(response.status, message, {
    code: body.error?.code,
    errorSubcode: body.error?.error_subcode,
    fbtraceId: body.error?.fbtrace_id,
    type: body.error?.type,
  });
}

export type GraphResult<T> = { data: T; usage: GraphUsageHeader[] };

/** Generic authenticated GET against the Graph API. */
export async function graphGet<T = unknown>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<GraphResult<T>> {
  const url = new URL(`${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const usage = parseGraphUsageHeaders(response.headers);
  logRateLimits(path, usage);

  if (!response.ok) {
    throw await parseGraphError(response);
  }

  return { data: (await response.json()) as T, usage };
}

/** Generic authenticated POST against the Graph API (form-encoded body). */
export async function graphPost<T = unknown>(
  path: string,
  accessToken: string,
  body: Record<string, string | number | boolean | undefined> = {},
): Promise<GraphResult<T>> {
  const url = new URL(`${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${path.replace(/^\//, "")}`);
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    form.set(key, String(value));
  }
  form.set("access_token", accessToken);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const usage = parseGraphUsageHeaders(response.headers);
  logRateLimits(path, usage);

  if (!response.ok) {
    throw await parseGraphError(response);
  }

  return { data: (await response.json()) as T, usage };
}

/** Generic authenticated DELETE against the Graph API. */
export async function graphDelete<T = unknown>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<GraphResult<T>> {
  const url = new URL(`${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, { method: "DELETE" });
  const usage = parseGraphUsageHeaders(response.headers);

  if (!response.ok) {
    throw await parseGraphError(response);
  }

  return { data: (await response.json()) as T, usage };
}

export type GraphPagedResponse<T> = {
  data: T[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string; previous?: string };
};

/** Follows `paging.next` until exhausted or `maxPages` reached (default 10 ⇒ up to 2500 rows at 250/page). */
export async function graphGetAllPages<T = unknown>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | boolean | undefined> = {},
  maxPages = 10,
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | undefined;
  let page = 0;

  while (page < maxPages) {
    page += 1;
    let json: GraphPagedResponse<T>;

    if (nextUrl) {
      const response = await fetch(nextUrl);
      if (!response.ok) throw await parseGraphError(response);
      json = (await response.json()) as GraphPagedResponse<T>;
    } else {
      const { data } = await graphGet<GraphPagedResponse<T>>(path, accessToken, {
        ...params,
        limit: params.limit ?? 250,
      });
      json = data;
    }

    results.push(...(json.data ?? []));
    nextUrl = json.paging?.next;
    if (!nextUrl) break;
  }

  return results;
}

/* ─── Domain-specific Graph reads ───────────────────────────────────────── */

export type GraphBusiness = { id: string; name: string; verification_status?: string };

export function getBusinesses(accessToken: string) {
  return graphGetAllPages<GraphBusiness>("me/businesses", accessToken, {
    fields: "id,name,verification_status",
  });
}

export type GraphAdAccount = {
  id: string;
  account_id: string;
  name: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
};

export function getAdAccounts(accessToken: string, businessId?: string) {
  const path = businessId ? `${businessId}/owned_ad_accounts` : "me/adaccounts";
  return graphGetAllPages<GraphAdAccount>(path, accessToken, {
    fields: "id,account_id,name,currency,timezone_name,account_status",
  });
}

export type GraphPage = { id: string; name: string; category?: string; access_token?: string };

export function getPages(accessToken: string, businessId?: string) {
  const path = businessId ? `${businessId}/owned_pages` : "me/accounts";
  return graphGetAllPages<GraphPage>(path, accessToken, {
    fields: "id,name,category,access_token",
  });
}

export type GraphLeadForm = { id: string; name: string; status?: string; locale?: string };

export function getLeadForms(pageId: string, accessToken: string) {
  return graphGetAllPages<GraphLeadForm>(`${pageId}/leadgen_forms`, accessToken, {
    fields: "id,name,status,locale",
  });
}

/**
 * Subscribes this Meta app to Page `leadgen` webhooks.
 * Uses the Page access token; requires the app webhook callback to already be configured.
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages
 */
export async function subscribePageToLeadgen(
  pageId: string,
  pageAccessToken: string,
): Promise<{ success: boolean }> {
  const { data } = await graphPost<{ success?: boolean }>(
    `${pageId}/subscribed_apps`,
    pageAccessToken,
    {
      subscribed_fields: "leadgen",
    },
  );
  return { success: data.success !== false };
}

/** Lists apps currently subscribed to a Page (for diagnostics). */
export async function getPageSubscribedApps(pageId: string, pageAccessToken: string) {
  const { data } = await graphGet<{ data?: Array<{ id: string; subscribed_fields?: string[] }> }>(
    `${pageId}/subscribed_apps`,
    pageAccessToken,
  );
  return data.data ?? [];
}

export type GraphPixel = { id: string; name: string };

export function getPixels(accessToken: string, businessId?: string) {
  const path = businessId ? `${businessId}/owned_pixels` : undefined;
  if (!path) return Promise.resolve<GraphPixel[]>([]);
  return graphGetAllPages<GraphPixel>(path, accessToken, { fields: "id,name" });
}

export function getAdAccountPixels(adAccountId: string, accessToken: string) {
  return graphGetAllPages<GraphPixel>(`${adAccountId}/adspixels`, accessToken, {
    fields: "id,name",
  });
}

export type GraphCampaign = {
  id: string;
  name: string;
  status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
};

export function getCampaigns(adAccountId: string, accessToken: string) {
  return graphGetAllPages<GraphCampaign>(`${adAccountId}/campaigns`, accessToken, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
  });
}

export type GraphAdset = {
  id: string;
  name: string;
  status?: string;
  daily_budget?: string;
  campaign_id?: string;
};

export function getAdsets(campaignId: string, accessToken: string) {
  return graphGetAllPages<GraphAdset>(`${campaignId}/adsets`, accessToken, {
    fields: "id,name,status,daily_budget,campaign_id",
  });
}

export type GraphAd = {
  id: string;
  name: string;
  status?: string;
  creative?: { id?: string };
  adset_id?: string;
};

export function getAds(adsetId: string, accessToken: string) {
  return graphGetAllPages<GraphAd>(`${adsetId}/ads`, accessToken, {
    fields: "id,name,status,creative,adset_id",
  });
}

export type GraphInsightsRow = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start?: string;
  date_stop?: string;
};

export async function getInsights(
  objectId: string,
  accessToken: string,
  options: { datePreset?: string; since?: string; until?: string } = {},
): Promise<GraphInsightsRow[]> {
  const params: Record<string, string | number | boolean | undefined> = {
    fields:
      "spend,impressions,clicks,ctr,cpc,actions,date_start,date_stop,campaign_id,adset_id,ad_id",
  };
  if (options.since && options.until) {
    params.time_range = JSON.stringify({ since: options.since, until: options.until });
  } else {
    params.date_preset = options.datePreset ?? "last_7d";
  }
  return graphGetAllPages<GraphInsightsRow>(`${objectId}/insights`, accessToken, params);
}

export type GraphLeadFieldData = { name: string; values: string[] };

export type GraphLeadDetails = {
  id?: string;
  created_time?: string;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
  field_data?: GraphLeadFieldData[];
  [key: string]: unknown;
};

/** Token-parameterized lead detail fetch (unlike `facebook.ts#getLeadDetails`, which is env-token only). */
export async function getLeadDetails(
  leadId: string,
  accessToken: string,
): Promise<GraphLeadDetails> {
  const { data } = await graphGet<GraphLeadDetails>(leadId, accessToken, {
    fields: "id,created_time,ad_id,adset_id,campaign_id,form_id,field_data",
  });
  return data;
}

/* ─── OAuth token exchange ───────────────────────────────────────────────── */

export function getOAuthDialogUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string[];
}): string {
  const url = new URL(`${OAUTH_BASE_URL}/${GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", params.scope.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export type OAuthTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

/** Exchanges an OAuth `code` (from the dialog redirect) for a short-lived user access token. */
export async function exchangeCodeForToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<OAuthTokenResponse> {
  const url = new URL(`${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("client_secret", params.clientSecret);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("code", params.code);

  const response = await fetch(url);
  if (!response.ok) {
    throw await parseGraphError(response);
  }
  return (await response.json()) as OAuthTokenResponse;
}

/** Exchanges a short-lived user token for a long-lived one (~60 days). Also used to "refresh" (reset the clock on) an existing long-lived token. */
export async function exchangeForLongLivedToken(params: {
  clientId: string;
  clientSecret: string;
  shortLivedToken: string;
}): Promise<OAuthTokenResponse> {
  const url = new URL(`${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("client_secret", params.clientSecret);
  url.searchParams.set("fb_exchange_token", params.shortLivedToken);

  const response = await fetch(url);
  if (!response.ok) {
    throw await parseGraphError(response);
  }
  return (await response.json()) as OAuthTokenResponse;
}

export type DebugTokenResponse = {
  data: {
    app_id?: string;
    type?: string;
    application?: string;
    expires_at?: number;
    data_access_expires_at?: number;
    is_valid?: boolean;
    scopes?: string[];
    user_id?: string;
  };
};

/** Introspects a token's validity/expiry/scopes via `/debug_token`. */
export async function debugToken(
  inputToken: string,
  appAccessToken: string,
): Promise<DebugTokenResponse["data"]> {
  const { data } = await graphGet<DebugTokenResponse>("debug_token", appAccessToken, {
    input_token: inputToken,
  });
  return data.data;
}
