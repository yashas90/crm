/**
 * Periodic/manual sync of Meta ad structure (campaigns → adsets → ads) and
 * performance insights for selected ad accounts. Every run is recorded in
 * `facebook_sync_history` for auditability (see GET /api/meta/sync-history).
 */
import {
  facebookAccounts,
  facebookAds,
  facebookAdsets,
  facebookCampaigns,
  facebookSyncHistory,
} from "@propninja/db";
import { and, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import {
  type GraphInsightsRow,
  getAds,
  getAdsets,
  getCampaigns,
  getInsights,
} from "../lib/metaGraphClient.js";
import { getActiveAccessToken } from "./metaTokenService.js";

async function startSyncHistory(orgId: string, syncType: string) {
  const [row] = await db
    .insert(facebookSyncHistory)
    .values({ orgId, syncType, status: "running" })
    .returning({ id: facebookSyncHistory.id });
  return row!.id;
}

async function finishSyncHistory(
  id: string,
  result: { processed: number; failed: number; errorMessage?: string },
) {
  const status =
    result.errorMessage && result.processed === 0
      ? "failed"
      : result.failed > 0
        ? "partial"
        : "success";
  await db
    .update(facebookSyncHistory)
    .set({
      status,
      finishedAt: new Date(),
      recordsProcessed: result.processed,
      recordsFailed: result.failed,
      errorMessage: result.errorMessage ?? null,
    })
    .where(eq(facebookSyncHistory.id, id));
}

async function selectAdAccounts(orgId: string, adAccountIds?: string[]) {
  const rows = await db
    .select()
    .from(facebookAccounts)
    .where(and(eq(facebookAccounts.orgId, orgId), eq(facebookAccounts.isSelected, true)));

  if (!adAccountIds?.length) return rows;
  const filterSet = new Set(adAccountIds);
  return rows.filter((row) => filterSet.has(row.adAccountId) || filterSet.has(row.id));
}

export type SyncCampaignsResult = { processed: number; failed: number; syncHistoryId: string };

/** Syncs campaigns → adsets → ads for selected (or given) ad accounts into the DB mirror tables. */
export async function syncCampaigns(
  orgId: string = SINGLE_TENANT_ORG_ID,
  adAccountIds?: string[],
): Promise<SyncCampaignsResult> {
  const syncHistoryId = await startSyncHistory(orgId, "campaigns");
  let processed = 0;
  let failed = 0;

  const accessToken = await getActiveAccessToken(orgId);
  if (!accessToken) {
    await finishSyncHistory(syncHistoryId, {
      processed: 0,
      failed: 0,
      errorMessage: "No active Meta access token",
    });
    return { processed: 0, failed: 0, syncHistoryId };
  }

  const accounts = await selectAdAccounts(orgId, adAccountIds);

  for (const account of accounts) {
    try {
      const campaigns = await getCampaigns(account.adAccountId, accessToken);

      for (const campaign of campaigns) {
        const [campaignRow] = await db
          .insert(facebookCampaigns)
          .values({
            orgId,
            adAccountId: account.id,
            campaignId: campaign.id,
            name: campaign.name,
            status: campaign.status ?? null,
            objective: campaign.objective ?? null,
            dailyBudget: campaign.daily_budget ?? null,
            lifetimeBudget: campaign.lifetime_budget ?? null,
            startTime: campaign.start_time ? new Date(campaign.start_time) : null,
            stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
          })
          .onConflictDoUpdate({
            target: [facebookCampaigns.orgId, facebookCampaigns.campaignId],
            set: {
              name: campaign.name,
              status: campaign.status ?? null,
              objective: campaign.objective ?? null,
              dailyBudget: campaign.daily_budget ?? null,
              lifetimeBudget: campaign.lifetime_budget ?? null,
              updatedAt: new Date(),
            },
          })
          .returning({ id: facebookCampaigns.id });

        processed += 1;
        if (!campaignRow) continue;

        const adsets = await getAdsets(campaign.id, accessToken).catch((error) => {
          logger.warn("Meta sync: failed to list adsets", {
            campaignId: campaign.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return [];
        });

        for (const adset of adsets) {
          const [adsetRow] = await db
            .insert(facebookAdsets)
            .values({
              orgId,
              campaignId: campaignRow.id,
              adsetId: adset.id,
              name: adset.name,
              status: adset.status ?? null,
              dailyBudget: adset.daily_budget ?? null,
            })
            .onConflictDoUpdate({
              target: [facebookAdsets.orgId, facebookAdsets.adsetId],
              set: {
                name: adset.name,
                status: adset.status ?? null,
                dailyBudget: adset.daily_budget ?? null,
                updatedAt: new Date(),
              },
            })
            .returning({ id: facebookAdsets.id });

          if (!adsetRow) continue;

          const ads = await getAds(adset.id, accessToken).catch((error) => {
            logger.warn("Meta sync: failed to list ads", {
              adsetId: adset.id,
              error: error instanceof Error ? error.message : String(error),
            });
            return [];
          });

          for (const ad of ads) {
            await db
              .insert(facebookAds)
              .values({
                orgId,
                adsetId: adsetRow.id,
                adId: ad.id,
                name: ad.name,
                status: ad.status ?? null,
                creativeId: ad.creative?.id ?? null,
              })
              .onConflictDoUpdate({
                target: [facebookAds.orgId, facebookAds.adId],
                set: {
                  name: ad.name,
                  status: ad.status ?? null,
                  creativeId: ad.creative?.id ?? null,
                  updatedAt: new Date(),
                },
              });
          }
        }
      }
    } catch (error) {
      failed += 1;
      logger.error("Meta sync: failed to sync ad account campaigns", {
        adAccountId: account.adAccountId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await finishSyncHistory(syncHistoryId, { processed, failed });
  return { processed, failed, syncHistoryId };
}

function summarizeInsights(rows: GraphInsightsRow[]): Record<string, unknown> {
  if (rows.length === 0) return {};
  const totals = rows.reduce(
    (acc, row) => ({
      spend: acc.spend + Number(row.spend ?? 0),
      impressions: acc.impressions + Number(row.impressions ?? 0),
      clicks: acc.clicks + Number(row.clicks ?? 0),
    }),
    { spend: 0, impressions: 0, clicks: 0 },
  );
  return { ...totals, raw: rows };
}

export type SyncInsightsResult = { processed: number; failed: number; syncHistoryId: string };

/** Fetches and stores performance insights for every synced campaign/adset/ad. */
export async function syncInsights(
  orgId: string = SINGLE_TENANT_ORG_ID,
  options: { datePreset?: string; since?: string; until?: string } = {},
): Promise<SyncInsightsResult> {
  const syncHistoryId = await startSyncHistory(orgId, "insights");
  let processed = 0;
  let failed = 0;

  const accessToken = await getActiveAccessToken(orgId);
  if (!accessToken) {
    await finishSyncHistory(syncHistoryId, {
      processed: 0,
      failed: 0,
      errorMessage: "No active Meta access token",
    });
    return { processed: 0, failed: 0, syncHistoryId };
  }

  const campaigns = await db
    .select({ id: facebookCampaigns.id, campaignId: facebookCampaigns.campaignId })
    .from(facebookCampaigns)
    .where(eq(facebookCampaigns.orgId, orgId));

  for (const campaign of campaigns) {
    try {
      const rows = await getInsights(campaign.campaignId, accessToken, options);
      await db
        .update(facebookCampaigns)
        .set({ insights: summarizeInsights(rows), insightsSyncedAt: new Date() })
        .where(eq(facebookCampaigns.id, campaign.id));
      processed += 1;
    } catch (error) {
      failed += 1;
      logger.error("Meta sync: failed to fetch campaign insights", {
        campaignId: campaign.campaignId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await finishSyncHistory(syncHistoryId, { processed, failed });
  return { processed, failed, syncHistoryId };
}
