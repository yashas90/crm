/**
 * Stores/retrieves encrypted Meta (Facebook) OAuth tokens for the Meta Business
 * Integration. User tokens are long-lived (~60 days) and are "refreshed" by
 * re-exchanging them before they expire; page tokens are stored per-page and
 * fall back to the legacy `PAGE_ACCESS_TOKEN` env var for single-page setups.
 */
import { facebookPages, facebookTokens } from "@propninja/db";
import { and, desc, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { exchangeForLongLivedToken } from "../lib/metaGraphClient.js";
import { decryptSecret, encryptSecret } from "../lib/tokenEncryption.js";

/** Refresh proactively once fewer than this many ms remain before expiry (7 days). */
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type StoreUserTokenInput = {
  orgId?: string;
  userId?: string | null;
  metaUserId?: string | null;
  accessToken: string;
  expiresIn?: number;
  scopes?: string[];
  tokenDataAccessExpiresAt?: Date | null;
};

/** Upserts the org's active Meta user token (one active row per org, per `tokenType`). */
export async function storeUserToken(input: StoreUserTokenInput) {
  const orgId = input.orgId ?? SINGLE_TENANT_ORG_ID;
  const expiresAt = input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000) : null;

  const [existing] = await db
    .select({ id: facebookTokens.id })
    .from(facebookTokens)
    .where(
      and(
        eq(facebookTokens.orgId, orgId),
        eq(facebookTokens.tokenType, "user"),
        eq(facebookTokens.status, "active"),
      ),
    )
    .limit(1);

  const values = {
    orgId,
    userId: input.userId ?? null,
    metaUserId: input.metaUserId ?? null,
    tokenType: "user" as const,
    accessTokenEncrypted: encryptSecret(input.accessToken),
    scopes: input.scopes ?? [],
    expiresAt,
    tokenDataAccessExpiresAt: input.tokenDataAccessExpiresAt ?? null,
    lastRefreshedAt: new Date(),
    status: "active" as const,
    updatedAt: new Date(),
  };

  if (existing) {
    const [row] = await db
      .update(facebookTokens)
      .set(values)
      .where(eq(facebookTokens.id, existing.id))
      .returning();
    return row!;
  }

  const [row] = await db.insert(facebookTokens).values(values).returning();
  return row!;
}

async function getActiveUserTokenRow(orgId: string) {
  const [row] = await db
    .select()
    .from(facebookTokens)
    .where(
      and(
        eq(facebookTokens.orgId, orgId),
        eq(facebookTokens.tokenType, "user"),
        eq(facebookTokens.status, "active"),
      ),
    )
    .orderBy(desc(facebookTokens.updatedAt))
    .limit(1);
  return row ?? null;
}

/** Re-exchanges the org's current long-lived user token for a fresh one (resets the ~60-day clock). */
export async function refreshLongLivedUserToken(
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<string | null> {
  const row = await getActiveUserTokenRow(orgId);
  if (!row) return null;

  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    logger.warn("Cannot refresh Meta user token — META_APP_ID/META_APP_SECRET not configured");
    return decryptSecret(row.accessTokenEncrypted);
  }

  try {
    const current = decryptSecret(row.accessTokenEncrypted);
    const result = await exchangeForLongLivedToken({
      clientId: env.META_APP_ID,
      clientSecret: env.META_APP_SECRET,
      shortLivedToken: current,
    });

    const expiresAt = result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null;

    await db
      .update(facebookTokens)
      .set({
        accessTokenEncrypted: encryptSecret(result.access_token),
        expiresAt,
        lastRefreshedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(facebookTokens.id, row.id));

    logger.info("Refreshed Meta long-lived user token", { orgId });
    return result.access_token;
  } catch (error) {
    logger.error("Failed to refresh Meta long-lived user token", {
      orgId,
      error: error instanceof Error ? error.message : String(error),
    });
    await db
      .update(facebookTokens)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(facebookTokens.id, row.id));
    return null;
  }
}

/** Returns a valid decrypted access token for the org, refreshing it first if it's nearing expiry. */
export async function getActiveAccessToken(
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<string | null> {
  const row = await getActiveUserTokenRow(orgId);
  if (!row) return null;

  const nearingExpiry =
    row.expiresAt && row.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS;
  if (nearingExpiry) {
    const refreshed = await refreshLongLivedUserToken(orgId);
    if (refreshed) return refreshed;
  }

  return decryptSecret(row.accessTokenEncrypted);
}

/**
 * Resolves an access token to fetch a specific Meta Page's lead data:
 * 1. `facebook_pages.access_token_encrypted` (multi-page, DB-synced setups)
 * 2. `PAGE_ACCESS_TOKEN` env var (legacy single-page setups)
 */
export async function getPageAccessToken(
  orgId: string,
  metaPageId: string | undefined,
): Promise<string | undefined> {
  if (metaPageId) {
    const [page] = await db
      .select({ accessTokenEncrypted: facebookPages.accessTokenEncrypted })
      .from(facebookPages)
      .where(and(eq(facebookPages.orgId, orgId), eq(facebookPages.pageId, metaPageId)))
      .limit(1);

    if (page?.accessTokenEncrypted) {
      return decryptSecret(page.accessTokenEncrypted);
    }
  }

  return env.PAGE_ACCESS_TOKEN?.trim() || undefined;
}

/** Marks all active tokens for the org as revoked (used by disconnect). */
export async function revokeOrgTokens(orgId: string = SINGLE_TENANT_ORG_ID): Promise<void> {
  await db
    .update(facebookTokens)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(eq(facebookTokens.orgId, orgId), eq(facebookTokens.status, "active")));
}
