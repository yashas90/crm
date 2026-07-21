/**
 * Aggregates Meta Business Integration status for the admin dashboard
 * (GET /api/meta/dashboard): asset counts, lead volume trends, top campaigns,
 * token expiry, and webhook/CAPI health.
 */
import {
  facebookAccounts,
  facebookBusinesses,
  facebookCampaigns,
  facebookConversionEvents,
  facebookForms,
  facebookLeads,
  facebookPages,
  facebookPixels,
  facebookTokens,
  facebookWebhooks,
} from "@propninja/db";
import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";

function startOfDay(daysAgo = 0): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

async function countLeadsSince(orgId: string, since: Date, until?: Date) {
  const conditions = [eq(facebookLeads.orgId, orgId), gte(facebookLeads.ingestedAt, since)];
  if (until) conditions.push(lt(facebookLeads.ingestedAt, until));
  const [row] = await db
    .select({ value: count() })
    .from(facebookLeads)
    .where(and(...conditions));
  return row?.value ?? 0;
}

async function countBusinesses(orgId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(facebookBusinesses)
    .where(eq(facebookBusinesses.orgId, orgId));
  return row?.value ?? 0;
}

async function countPages(orgId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(facebookPages)
    .where(eq(facebookPages.orgId, orgId));
  return row?.value ?? 0;
}

async function countPixels(orgId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(facebookPixels)
    .where(eq(facebookPixels.orgId, orgId));
  return row?.value ?? 0;
}

async function countForms(orgId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(facebookForms)
    .where(eq(facebookForms.orgId, orgId));
  return row?.value ?? 0;
}

async function countAdAccounts(orgId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(facebookAccounts)
    .where(eq(facebookAccounts.orgId, orgId));
  return row?.value ?? 0;
}

export type MetaDashboardData = {
  assets: {
    businesses: number;
    pages: number;
    pixels: number;
    forms: number;
    adAccounts: number;
  };
  leads: {
    today: number;
    yesterday: number;
    last7Days: number;
    last30Days: number;
  };
  topCampaigns: Array<{
    id: string;
    campaignId: string;
    name: string;
    status: string | null;
    spend: number;
  }>;
  token: {
    connected: boolean;
    status: string | null;
    expiresAt: string | null;
    expiringSoon: boolean;
  };
  webhooks: Record<string, number>;
  conversionEvents: Record<string, number>;
};

export async function getMetaDashboard(
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<MetaDashboardData> {
  const [businesses, pages, pixels, forms, adAccounts] = await Promise.all([
    countBusinesses(orgId),
    countPages(orgId),
    countPixels(orgId),
    countForms(orgId),
    countAdAccounts(orgId),
  ]);

  const today = startOfDay(0);
  const yesterday = startOfDay(1);
  const sevenDaysAgo = startOfDay(7);
  const thirtyDaysAgo = startOfDay(30);

  const [leadsToday, leadsYesterday, leadsLast7, leadsLast30] = await Promise.all([
    countLeadsSince(orgId, today),
    countLeadsSince(orgId, yesterday, today),
    countLeadsSince(orgId, sevenDaysAgo),
    countLeadsSince(orgId, thirtyDaysAgo),
  ]);

  const campaignRows = await db
    .select({
      id: facebookCampaigns.id,
      campaignId: facebookCampaigns.campaignId,
      name: facebookCampaigns.name,
      status: facebookCampaigns.status,
      insights: facebookCampaigns.insights,
    })
    .from(facebookCampaigns)
    .where(eq(facebookCampaigns.orgId, orgId));

  const topCampaigns = campaignRows
    .map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      name: row.name,
      status: row.status,
      spend: Number((row.insights as { spend?: number } | null)?.spend ?? 0),
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  const [tokenRow] = await db
    .select({
      status: facebookTokens.status,
      expiresAt: facebookTokens.expiresAt,
    })
    .from(facebookTokens)
    .where(and(eq(facebookTokens.orgId, orgId), eq(facebookTokens.tokenType, "user")))
    .orderBy(desc(facebookTokens.updatedAt))
    .limit(1);

  const expiringSoon = Boolean(
    tokenRow?.expiresAt && tokenRow.expiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000,
  );

  const webhookRows = await db
    .select({ status: facebookWebhooks.status, value: count() })
    .from(facebookWebhooks)
    .where(eq(facebookWebhooks.orgId, orgId))
    .groupBy(facebookWebhooks.status);

  const conversionRows = await db
    .select({ status: facebookConversionEvents.status, value: count() })
    .from(facebookConversionEvents)
    .where(eq(facebookConversionEvents.orgId, orgId))
    .groupBy(facebookConversionEvents.status);

  return {
    assets: { businesses, pages, pixels, forms, adAccounts },
    leads: {
      today: leadsToday,
      yesterday: leadsYesterday,
      last7Days: leadsLast7,
      last30Days: leadsLast30,
    },
    topCampaigns,
    token: {
      connected: Boolean(tokenRow),
      status: tokenRow?.status ?? null,
      expiresAt: tokenRow?.expiresAt?.toISOString() ?? null,
      expiringSoon,
    },
    webhooks: Object.fromEntries(webhookRows.map((r) => [r.status, r.value])),
    conversionEvents: Object.fromEntries(conversionRows.map((r) => [r.status, r.value])),
  };
}
