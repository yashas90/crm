/**
 * Meta (Facebook) OAuth connect flow for the admin-facing Meta Business
 * Integration: builds the consent dialog URL, handles the redirect callback
 * (code → long-lived token), and syncs businesses/ad accounts/pages/lead
 * forms/pixels into the DB so the rest of the integration can operate without
 * further Graph calls for asset discovery.
 */
import {
  facebookAccounts,
  facebookBusinesses,
  facebookForms,
  facebookPages,
  facebookPixels,
} from "@propninja/db";
import { eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getAdAccountPixels,
  getAdAccounts,
  getBusinesses,
  getLeadForms,
  getOAuthDialogUrl,
  getPages,
  graphGet,
} from "../lib/metaGraphClient.js";
import { encryptSecret } from "../lib/tokenEncryption.js";
import { getActiveAccessToken, revokeOrgTokens, storeUserToken } from "./metaTokenService.js";

/** Scopes requested during the OAuth consent dialog. */
export const META_OAUTH_SCOPES = [
  "ads_read",
  "leads_retrieval",
  "pages_show_list",
  "pages_manage_ads",
  "business_management",
  "ads_management",
];

function getRedirectUri(): string {
  return (
    env.META_OAUTH_REDIRECT_URI?.trim() ||
    `${env.PUBLIC_API_BASE_URL ?? env.API_PUBLIC_URL ?? "http://localhost:3001"}/api/meta/oauth/callback`
  );
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(env.META_APP_ID?.trim() && env.META_APP_SECRET?.trim());
}

/** Builds the Meta consent dialog URL. `state` should uniquely identify the initiating user for the callback. */
export function getAuthUrl(state: string): string {
  if (!env.META_APP_ID) {
    throw new Error("NOT_CONFIGURED");
  }
  return getOAuthDialogUrl({
    clientId: env.META_APP_ID,
    redirectUri: getRedirectUri(),
    state,
    scope: META_OAUTH_SCOPES,
  });
}

type AssetSyncCounts = {
  businesses: number;
  adAccounts: number;
  pages: number;
  forms: number;
  pixels: number;
};

async function upsertBusinesses(orgId: string, accessToken: string) {
  const businesses = await getBusinesses(accessToken).catch((error) => {
    logger.warn("Meta business sync: failed to list businesses", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  });

  const idMap = new Map<string, string>();

  for (const business of businesses) {
    const [row] = await db
      .insert(facebookBusinesses)
      .values({
        orgId,
        businessId: business.id,
        name: business.name,
        verificationStatus: business.verification_status ?? null,
      })
      .onConflictDoUpdate({
        target: [facebookBusinesses.orgId, facebookBusinesses.businessId],
        set: {
          name: business.name,
          verificationStatus: business.verification_status ?? null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: facebookBusinesses.id });

    if (row) idMap.set(business.id, row.id);
  }

  return idMap;
}

async function upsertAdAccounts(
  orgId: string,
  accessToken: string,
  businessIdMap: Map<string, string>,
) {
  const idMap = new Map<string, string>();
  const businessEntries =
    businessIdMap.size > 0 ? [...businessIdMap.entries()] : [[undefined, undefined] as const];

  for (const [metaBusinessId, internalBusinessId] of businessEntries) {
    const accounts = await getAdAccounts(accessToken, metaBusinessId).catch((error) => {
      logger.warn("Meta business sync: failed to list ad accounts", {
        businessId: metaBusinessId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    });

    for (const account of accounts) {
      const [row] = await db
        .insert(facebookAccounts)
        .values({
          orgId,
          businessId: internalBusinessId ?? null,
          adAccountId: account.account_id,
          name: account.name,
          currency: account.currency ?? null,
          timezoneName: account.timezone_name ?? null,
          accountStatus: account.account_status ?? null,
        })
        .onConflictDoUpdate({
          target: [facebookAccounts.orgId, facebookAccounts.adAccountId],
          set: {
            name: account.name,
            currency: account.currency ?? null,
            timezoneName: account.timezone_name ?? null,
            accountStatus: account.account_status ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: facebookAccounts.id });

      if (row) idMap.set(account.account_id, row.id);
    }
  }

  return idMap;
}

async function upsertPagesAndForms(orgId: string, accessToken: string) {
  const pages = await getPages(accessToken).catch((error) => {
    logger.warn("Meta business sync: failed to list pages", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  });

  let formCount = 0;

  for (const page of pages) {
    const [row] = await db
      .insert(facebookPages)
      .values({
        orgId,
        pageId: page.id,
        name: page.name,
        category: page.category ?? null,
        accessTokenEncrypted: page.access_token ? encryptSecret(page.access_token) : null,
      })
      .onConflictDoUpdate({
        target: [facebookPages.orgId, facebookPages.pageId],
        set: {
          name: page.name,
          category: page.category ?? null,
          ...(page.access_token ? { accessTokenEncrypted: encryptSecret(page.access_token) } : {}),
          updatedAt: new Date(),
        },
      })
      .returning({ id: facebookPages.id });

    if (!row) continue;

    const pageAccessToken = page.access_token ?? accessToken;
    const forms = await getLeadForms(page.id, pageAccessToken).catch((error) => {
      logger.warn("Meta business sync: failed to list lead forms", {
        pageId: page.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    });

    for (const form of forms) {
      await db
        .insert(facebookForms)
        .values({
          orgId,
          pageId: row.id,
          formId: form.id,
          name: form.name,
          status: form.status ?? null,
          locale: form.locale ?? null,
        })
        .onConflictDoUpdate({
          target: [facebookForms.orgId, facebookForms.formId],
          set: {
            name: form.name,
            status: form.status ?? null,
            locale: form.locale ?? null,
            updatedAt: new Date(),
          },
        });
      formCount += 1;
    }
  }

  return { pageCount: pages.length, formCount };
}

async function upsertPixels(
  orgId: string,
  accessToken: string,
  adAccountIdMap: Map<string, string>,
) {
  let count = 0;

  for (const [metaAdAccountId, internalAdAccountId] of adAccountIdMap.entries()) {
    const pixels = await getAdAccountPixels(metaAdAccountId, accessToken).catch((error) => {
      logger.warn("Meta business sync: failed to list pixels", {
        adAccountId: metaAdAccountId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    });

    for (const pixel of pixels) {
      await db
        .insert(facebookPixels)
        .values({
          orgId,
          adAccountId: internalAdAccountId,
          pixelId: pixel.id,
          name: pixel.name,
        })
        .onConflictDoUpdate({
          target: [facebookPixels.orgId, facebookPixels.pixelId],
          set: { name: pixel.name, adAccountId: internalAdAccountId, updatedAt: new Date() },
        });
      count += 1;
    }
  }

  return count;
}

/** Full asset discovery sync: businesses → ad accounts → pages/forms → pixels. */
export async function syncAllAssets(orgId: string, accessToken: string): Promise<AssetSyncCounts> {
  const businessIdMap = await upsertBusinesses(orgId, accessToken);
  const adAccountIdMap = await upsertAdAccounts(orgId, accessToken, businessIdMap);
  const { pageCount, formCount } = await upsertPagesAndForms(orgId, accessToken);
  const pixelCount = await upsertPixels(orgId, accessToken, adAccountIdMap);

  return {
    businesses: businessIdMap.size,
    adAccounts: adAccountIdMap.size,
    pages: pageCount,
    forms: formCount,
    pixels: pixelCount,
  };
}

export type OAuthCallbackResult = { connected: true } & AssetSyncCounts;

/** Handles the `/api/meta/oauth/callback` redirect: exchanges `code` for a long-lived token and syncs assets. */
export async function handleCallback(
  code: string,
  userId: string | null,
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<OAuthCallbackResult> {
  if (!isMetaOAuthConfigured()) {
    throw new Error("NOT_CONFIGURED");
  }

  const shortLived = await exchangeCodeForToken({
    code,
    clientId: env.META_APP_ID!,
    clientSecret: env.META_APP_SECRET!,
    redirectUri: getRedirectUri(),
  });

  const longLived = await exchangeForLongLivedToken({
    clientId: env.META_APP_ID!,
    clientSecret: env.META_APP_SECRET!,
    shortLivedToken: shortLived.access_token,
  });

  let metaUserId: string | undefined;
  try {
    const { data } = await graphGet<{ id: string }>("me", longLived.access_token, {
      fields: "id",
    });
    metaUserId = data.id;
  } catch (error) {
    logger.warn("Meta OAuth callback: failed to resolve meta user id", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await storeUserToken({
    orgId,
    userId,
    metaUserId,
    accessToken: longLived.access_token,
    expiresIn: longLived.expires_in,
    scopes: META_OAUTH_SCOPES,
  });

  const counts = await syncAllAssets(orgId, longLived.access_token);
  logger.info("Meta OAuth connected and assets synced", { orgId, ...counts });

  return { connected: true, ...counts };
}

/** Re-syncs assets using the org's currently stored (and auto-refreshed) access token. */
export async function resyncAssets(orgId: string = SINGLE_TENANT_ORG_ID): Promise<AssetSyncCounts> {
  const accessToken = await getActiveAccessToken(orgId);
  if (!accessToken) {
    throw new Error("NOT_CONNECTED");
  }
  return syncAllAssets(orgId, accessToken);
}

/** Revokes stored tokens and marks synced pages/accounts inactive (assets are retained for audit history). */
export async function disconnect(orgId: string = SINGLE_TENANT_ORG_ID): Promise<void> {
  await revokeOrgTokens(orgId);
  await db.update(facebookPages).set({ isActive: false }).where(eq(facebookPages.orgId, orgId));
  await db
    .update(facebookAccounts)
    .set({ isActive: false })
    .where(eq(facebookAccounts.orgId, orgId));
  await db.update(facebookPixels).set({ isActive: false }).where(eq(facebookPixels.orgId, orgId));
  logger.info("Meta integration disconnected", { orgId });
}
