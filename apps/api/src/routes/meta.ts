/**
 * Authenticated admin/manager routes for the Meta Business Integration
 * (OAuth connect, asset browsing, manual sync/conversion triggers, dashboard).
 *
 * Distinct from `routes/integrationsMeta.ts`, which remains the public,
 * signature-verified `/api/integrations/meta/webhook` ingress.
 */
import {
  facebookAccounts,
  facebookAds,
  facebookAdsets,
  facebookBusinesses,
  facebookCampaigns,
  facebookForms,
  facebookLeads,
  facebookLogs,
  facebookPages,
  facebookPixels,
  facebookSyncHistory,
} from "@propninja/db";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { canUpdateOrgProfile, canViewOrgProfile } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import {
  enqueueConversionForLeadStatusChange,
  sendPendingConversionEvents,
} from "../services/metaConversionService.js";
import { getMetaDashboard } from "../services/metaDashboardService.js";
import {
  disconnect as disconnectMetaOAuth,
  getAuthUrl,
  handleCallback,
  isMetaOAuthConfigured,
} from "../services/metaOAuthService.js";
import { syncCampaigns, syncInsights } from "../services/metaSyncService.js";
import { refreshLongLivedUserToken } from "../services/metaTokenService.js";

export const metaRoutes = new Hono();

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

function requireView(c: Context) {
  const authUser = c.get("authUser") as AuthUser;
  if (!canViewOrgProfile(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

function requireManage(c: Context) {
  const authUser = c.get("authUser") as AuthUser;
  if (!canUpdateOrgProfile(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

/* ─── Asset reads ────────────────────────────────────────────────────────── */

metaRoutes.get("/businesses", async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const rows = await db
    .select()
    .from(facebookBusinesses)
    .where(eq(facebookBusinesses.orgId, SINGLE_TENANT_ORG_ID))
    .orderBy(desc(facebookBusinesses.createdAt));
  return jsonOk(c, rows);
});

metaRoutes.get("/pages", async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const rows = await db
    .select()
    .from(facebookPages)
    .where(eq(facebookPages.orgId, SINGLE_TENANT_ORG_ID))
    .orderBy(desc(facebookPages.createdAt));
  return jsonOk(c, rows);
});

metaRoutes.get(
  "/forms",
  validate("query", z.object({ pageId: z.string().uuid().optional() })),
  async (c) => {
    const denied = requireView(c);
    if (denied) return denied;

    const { pageId } = c.req.valid("query");
    const conditions = [eq(facebookForms.orgId, SINGLE_TENANT_ORG_ID)];
    if (pageId) conditions.push(eq(facebookForms.pageId, pageId));

    const rows = await db
      .select()
      .from(facebookForms)
      .where(and(...conditions))
      .orderBy(desc(facebookForms.createdAt));
    return jsonOk(c, rows);
  },
);

metaRoutes.get("/pixels", async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const rows = await db
    .select()
    .from(facebookPixels)
    .where(eq(facebookPixels.orgId, SINGLE_TENANT_ORG_ID))
    .orderBy(desc(facebookPixels.createdAt));
  return jsonOk(c, rows);
});

metaRoutes.get(
  "/campaigns",
  validate("query", z.object({ adAccountId: z.string().uuid().optional() })),
  async (c) => {
    const denied = requireView(c);
    if (denied) return denied;

    const { adAccountId } = c.req.valid("query");
    const conditions = [eq(facebookCampaigns.orgId, SINGLE_TENANT_ORG_ID)];
    if (adAccountId) conditions.push(eq(facebookCampaigns.adAccountId, adAccountId));

    const rows = await db
      .select()
      .from(facebookCampaigns)
      .where(and(...conditions))
      .orderBy(desc(facebookCampaigns.createdAt));
    return jsonOk(c, rows);
  },
);

metaRoutes.get(
  "/adsets",
  validate("query", z.object({ campaignId: z.string().uuid().optional() })),
  async (c) => {
    const denied = requireView(c);
    if (denied) return denied;

    const { campaignId } = c.req.valid("query");
    const conditions = [eq(facebookAdsets.orgId, SINGLE_TENANT_ORG_ID)];
    if (campaignId) conditions.push(eq(facebookAdsets.campaignId, campaignId));

    const rows = await db
      .select()
      .from(facebookAdsets)
      .where(and(...conditions))
      .orderBy(desc(facebookAdsets.createdAt));
    return jsonOk(c, rows);
  },
);

metaRoutes.get(
  "/ads",
  validate("query", z.object({ adsetId: z.string().uuid().optional() })),
  async (c) => {
    const denied = requireView(c);
    if (denied) return denied;

    const { adsetId } = c.req.valid("query");
    const conditions = [eq(facebookAds.orgId, SINGLE_TENANT_ORG_ID)];
    if (adsetId) conditions.push(eq(facebookAds.adsetId, adsetId));

    const rows = await db
      .select()
      .from(facebookAds)
      .where(and(...conditions))
      .orderBy(desc(facebookAds.createdAt));
    return jsonOk(c, rows);
  },
);

metaRoutes.get("/leads", validate("query", paginationSchema), async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const { page, pageSize } = c.req.valid("query");
  const offset = (page - 1) * pageSize;

  const [rows, [{ value: total } = { value: 0 }]] = await Promise.all([
    db
      .select()
      .from(facebookLeads)
      .where(eq(facebookLeads.orgId, SINGLE_TENANT_ORG_ID))
      .orderBy(desc(facebookLeads.ingestedAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(facebookLeads)
      .where(eq(facebookLeads.orgId, SINGLE_TENANT_ORG_ID)),
  ]);

  return jsonOk(c, rows, { page, pageSize, total });
});

metaRoutes.get("/logs", validate("query", paginationSchema), async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const { page, pageSize } = c.req.valid("query");
  const offset = (page - 1) * pageSize;

  const [rows, [{ value: total } = { value: 0 }]] = await Promise.all([
    db
      .select()
      .from(facebookLogs)
      .where(eq(facebookLogs.orgId, SINGLE_TENANT_ORG_ID))
      .orderBy(desc(facebookLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(facebookLogs)
      .where(eq(facebookLogs.orgId, SINGLE_TENANT_ORG_ID)),
  ]);

  return jsonOk(c, rows, { page, pageSize, total });
});

metaRoutes.get("/sync-history", validate("query", paginationSchema), async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const { page, pageSize } = c.req.valid("query");
  const offset = (page - 1) * pageSize;

  const [rows, [{ value: total } = { value: 0 }]] = await Promise.all([
    db
      .select()
      .from(facebookSyncHistory)
      .where(eq(facebookSyncHistory.orgId, SINGLE_TENANT_ORG_ID))
      .orderBy(desc(facebookSyncHistory.startedAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(facebookSyncHistory)
      .where(eq(facebookSyncHistory.orgId, SINGLE_TENANT_ORG_ID)),
  ]);

  return jsonOk(c, rows, { page, pageSize, total });
});

metaRoutes.get("/dashboard", async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const data = await getMetaDashboard(SINGLE_TENANT_ORG_ID);
  return jsonOk(c, data);
});

/* ─── OAuth connect flow ─────────────────────────────────────────────────── */

metaRoutes.post("/connect", writeRateLimit, async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  if (!isMetaOAuthConfigured()) {
    return jsonError(
      c,
      "NOT_CONFIGURED",
      "Meta integration not configured. Set META_APP_ID and META_APP_SECRET.",
      503,
    );
  }

  const authUser = c.get("authUser") as AuthUser;
  const url = getAuthUrl(authUser.id);
  return jsonOk(c, { url });
});

/** GET /api/meta/oauth/callback — Meta redirects the browser here with `code`/`state` (state = initiating userId). */
metaRoutes.get("/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const webUrl = env.WEB_APP_URL ?? process.env.WEB_BASE_URL ?? "http://localhost:3000";

  if (error || !code) {
    return c.redirect(`${webUrl}/settings/integrations?meta=error`);
  }

  try {
    await handleCallback(code, state ?? null);
    return c.redirect(`${webUrl}/settings/integrations?meta=connected`);
  } catch (err) {
    logger.error("Meta OAuth callback failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.redirect(`${webUrl}/settings/integrations?meta=error`);
  }
});

metaRoutes.delete("/disconnect", writeRateLimit, async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  await disconnectMetaOAuth(SINGLE_TENANT_ORG_ID);
  return jsonOk(c, { disconnected: true });
});

metaRoutes.put("/token", writeRateLimit, async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const accessToken = await refreshLongLivedUserToken(SINGLE_TENANT_ORG_ID);
  if (!accessToken) {
    return jsonError(c, "NOT_CONNECTED", "No active Meta token to refresh", 400);
  }
  return jsonOk(c, { refreshed: true });
});

/* ─── Sync / conversion / asset selection ───────────────────────────────── */

const syncBodySchema = z.object({
  type: z.enum(["campaigns", "insights", "all"]).default("all"),
  adAccountIds: z.array(z.string()).optional(),
  datePreset: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

metaRoutes.post("/sync", writeRateLimit, validate("json", syncBodySchema), async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const body = c.req.valid("json");
  const results: Record<string, unknown> = {};

  if (body.type === "campaigns" || body.type === "all") {
    results.campaigns = await syncCampaigns(SINGLE_TENANT_ORG_ID, body.adAccountIds);
  }
  if (body.type === "insights" || body.type === "all") {
    results.insights = await syncInsights(SINGLE_TENANT_ORG_ID, {
      datePreset: body.datePreset,
      since: body.since,
      until: body.until,
    });
  }

  return jsonOk(c, results);
});

const conversionBodySchema = z.object({
  leadId: z.string().uuid(),
  status: z.string().min(1),
});

metaRoutes.post(
  "/conversion",
  writeRateLimit,
  validate("json", conversionBodySchema),
  async (c) => {
    const denied = requireManage(c);
    if (denied) return denied;

    const { leadId, status } = c.req.valid("json");
    const result = await enqueueConversionForLeadStatusChange(leadId, status, SINGLE_TENANT_ORG_ID);
    return jsonOk(c, result);
  },
);

metaRoutes.post("/conversion/flush", writeRateLimit, async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const result = await sendPendingConversionEvents({ orgId: SINGLE_TENANT_ORG_ID });
  return jsonOk(c, result);
});

const selectAssetsBodySchema = z.object({
  pageIds: z.array(z.string().uuid()).optional(),
  formIds: z.array(z.string().uuid()).optional(),
  pixelIds: z.array(z.string().uuid()).optional(),
  adAccountIds: z.array(z.string().uuid()).optional(),
});

metaRoutes.post(
  "/select-assets",
  writeRateLimit,
  validate("json", selectAssetsBodySchema),
  async (c) => {
    const denied = requireManage(c);
    if (denied) return denied;

    const { pageIds, formIds, pixelIds, adAccountIds } = c.req.valid("json");
    const orgId = SINGLE_TENANT_ORG_ID;

    if (pageIds) {
      await db
        .update(facebookPages)
        .set({ isSelected: false })
        .where(eq(facebookPages.orgId, orgId));
      if (pageIds.length > 0) {
        await db
          .update(facebookPages)
          .set({ isSelected: true })
          .where(and(eq(facebookPages.orgId, orgId), inArray(facebookPages.id, pageIds)));
      }
    }

    if (formIds) {
      await db
        .update(facebookForms)
        .set({ isSelected: false })
        .where(eq(facebookForms.orgId, orgId));
      if (formIds.length > 0) {
        await db
          .update(facebookForms)
          .set({ isSelected: true })
          .where(and(eq(facebookForms.orgId, orgId), inArray(facebookForms.id, formIds)));
      }
    }

    if (pixelIds) {
      await db
        .update(facebookPixels)
        .set({ isSelected: false })
        .where(eq(facebookPixels.orgId, orgId));
      if (pixelIds.length > 0) {
        await db
          .update(facebookPixels)
          .set({ isSelected: true })
          .where(and(eq(facebookPixels.orgId, orgId), inArray(facebookPixels.id, pixelIds)));
      }
    }

    if (adAccountIds) {
      await db
        .update(facebookAccounts)
        .set({ isSelected: false })
        .where(eq(facebookAccounts.orgId, orgId));
      if (adAccountIds.length > 0) {
        await db
          .update(facebookAccounts)
          .set({ isSelected: true })
          .where(
            and(eq(facebookAccounts.orgId, orgId), inArray(facebookAccounts.id, adAccountIds)),
          );
      }
    }

    return jsonOk(c, { updated: true });
  },
);
