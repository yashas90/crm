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
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
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
import { backfillMetaLeads } from "../services/metaLeadBackfillService.js";
import {
  disconnect as disconnectMetaOAuth,
  getAuthUrl,
  handleCallback,
  isMetaOAuthConfigured,
  resyncAssets,
} from "../services/metaOAuthService.js";
import { reconnectPage, syncPagesFormsAndSubscribe } from "../services/metaPageSyncService.js";
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
    .select({
      id: facebookPages.id,
      orgId: facebookPages.orgId,
      businessId: facebookPages.businessId,
      pageId: facebookPages.pageId,
      name: facebookPages.name,
      category: facebookPages.category,
      hasAccessToken: sql<boolean>`${facebookPages.accessTokenEncrypted} is not null`,
      isSelected: facebookPages.isSelected,
      isActive: facebookPages.isActive,
      leadgenSubscribed: facebookPages.leadgenSubscribed,
      projectId: facebookPages.projectId,
      createdAt: facebookPages.createdAt,
      updatedAt: facebookPages.updatedAt,
    })
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

/** Alias for checklist path `/api/meta/adaccounts` (rows live in `facebook_accounts`). */
metaRoutes.get("/adaccounts", async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const rows = await db
    .select({
      id: facebookAccounts.id,
      orgId: facebookAccounts.orgId,
      businessId: facebookAccounts.businessId,
      adAccountId: facebookAccounts.adAccountId,
      name: facebookAccounts.name,
      currency: facebookAccounts.currency,
      timezoneName: facebookAccounts.timezoneName,
      accountStatus: facebookAccounts.accountStatus,
      isSelected: facebookAccounts.isSelected,
      isActive: facebookAccounts.isActive,
      projectId: facebookAccounts.projectId,
      createdAt: facebookAccounts.createdAt,
      updatedAt: facebookAccounts.updatedAt,
    })
    .from(facebookAccounts)
    .where(eq(facebookAccounts.orgId, SINGLE_TENANT_ORG_ID))
    .orderBy(desc(facebookAccounts.createdAt));
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

async function startMetaOAuth(c: Context) {
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
}

/** Preferred checklist path — returns `{ url }` for the Meta consent dialog. */
metaRoutes.get("/oauth", writeRateLimit, startMetaOAuth);
metaRoutes.post("/oauth", writeRateLimit, startMetaOAuth);
/** Legacy alias used by the web Connect button. */
metaRoutes.post("/connect", writeRateLimit, startMetaOAuth);

/** GET /api/meta/oauth/callback — Meta redirects the browser here with `code`/`state` (state = initiating userId). */
metaRoutes.get("/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const webUrl = env.WEB_APP_URL ?? process.env.WEB_BASE_URL ?? "http://localhost:3000";
  const metaSettings = `${webUrl}/settings/meta`;

  if (error || !code) {
    return c.redirect(`${metaSettings}?meta=error`);
  }

  try {
    await handleCallback(code, state ?? null);
    return c.redirect(`${metaSettings}?meta=connected`);
  } catch (err) {
    logger.error("Meta OAuth callback failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.redirect(`${metaSettings}?meta=error`);
  }
});

async function disconnectMeta(c: Context) {
  const denied = requireManage(c);
  if (denied) return denied;

  await disconnectMetaOAuth(SINGLE_TENANT_ORG_ID);
  return jsonOk(c, { disconnected: true });
}

metaRoutes.delete("/disconnect", writeRateLimit, disconnectMeta);
metaRoutes.post("/disconnect", writeRateLimit, disconnectMeta);

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
  type: z.enum(["campaigns", "insights", "assets", "all", "leads"]).default("all"),
  adAccountIds: z.array(z.string()).optional(),
  datePreset: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  sinceDays: z.number().int().min(1).max(90).optional(),
});

metaRoutes.post("/sync", writeRateLimit, validate("json", syncBodySchema), async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const body = c.req.valid("json");
  const results: Record<string, unknown> = {};

  if (body.type === "leads") {
    results.leads = await backfillMetaLeads(SINGLE_TENANT_ORG_ID, {
      sinceDays: body.sinceDays ?? 7,
    });
    return jsonOk(c, results);
  }

  if (body.type === "assets" || body.type === "all") {
    try {
      results.assets = await syncPagesFormsAndSubscribe(SINGLE_TENANT_ORG_ID);
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_CONNECTED") {
        return jsonError(c, "NOT_CONNECTED", "Connect Meta OAuth before syncing assets", 400);
      }
      throw error;
    }
  }
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

/** Pull Lead Ads from Graph for the last N days (catch-up when webhooks were missed). */
metaRoutes.post("/sync/leads", writeRateLimit, async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;
  const sinceDaysRaw = Number(c.req.query("sinceDays") ?? "7");
  const sinceDays = Number.isFinite(sinceDaysRaw) ? sinceDaysRaw : 7;
  const result = await backfillMetaLeads(SINGLE_TENANT_ORG_ID, { sinceDays });
  return jsonOk(c, result);
});

/** Explicit pages/forms discovery + leadgen subscribe (same as sync type=assets). */
metaRoutes.post("/sync/assets", writeRateLimit, async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;
  try {
    const result = await syncPagesFormsAndSubscribe(SINGLE_TENANT_ORG_ID);
    return jsonOk(c, result);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_CONNECTED") {
      return jsonError(c, "NOT_CONNECTED", "Connect Meta OAuth before syncing assets", 400);
    }
    throw error;
  }
});

/** Full OAuth asset re-sync (businesses, ad accounts, pages, forms, pixels, subscribe). */
metaRoutes.post("/sync/oauth-assets", writeRateLimit, async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;
  try {
    const result = await resyncAssets(SINGLE_TENANT_ORG_ID);
    return jsonOk(c, result);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_CONNECTED") {
      return jsonError(c, "NOT_CONNECTED", "Connect Meta OAuth first", 400);
    }
    throw error;
  }
});

const pagePatchSchema = z.object({
  isActive: z.boolean().optional(),
  isSelected: z.boolean().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

metaRoutes.patch("/pages/:id", writeRateLimit, validate("json", pagePatchSchema), async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const body = c.req.valid("json");
  const [row] = await db
    .update(facebookPages)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(facebookPages.id, id), eq(facebookPages.orgId, SINGLE_TENANT_ORG_ID)))
    .returning({
      id: facebookPages.id,
      pageId: facebookPages.pageId,
      name: facebookPages.name,
      isActive: facebookPages.isActive,
      isSelected: facebookPages.isSelected,
      leadgenSubscribed: facebookPages.leadgenSubscribed,
      projectId: facebookPages.projectId,
    });

  if (!row) return jsonError(c, "NOT_FOUND", "Page not found", 404);
  return jsonOk(c, row);
});

metaRoutes.post("/pages/:id/reconnect", writeRateLimit, async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const pageRowId = c.req.param("id");
  if (!pageRowId) {
    return jsonError(c, "VALIDATION_ERROR", "Page id is required", 400);
  }

  try {
    const result = await reconnectPage(pageRowId, SINGLE_TENANT_ORG_ID);
    return jsonOk(c, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "PAGE_NOT_FOUND") return jsonError(c, "NOT_FOUND", "Page not found", 404);
    if (message === "NOT_CONNECTED") {
      return jsonError(c, "NOT_CONNECTED", "Connect Meta OAuth first", 400);
    }
    if (message === "PAGE_TOKEN_UNAVAILABLE") {
      return jsonError(c, "PAGE_TOKEN_UNAVAILABLE", "Could not refresh page token from Meta", 400);
    }
    throw error;
  }
});

const formPatchSchema = z.object({
  isActive: z.boolean().optional(),
  isSelected: z.boolean().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  assignmentStrategy: z.enum(["round_robin", "first"]).optional(),
});

metaRoutes.patch("/forms/:id", writeRateLimit, validate("json", formPatchSchema), async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const body = c.req.valid("json");
  const [row] = await db
    .update(facebookForms)
    .set({
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.isSelected !== undefined ? { isSelected: body.isSelected } : {}),
      ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
      ...(body.assigneeIds !== undefined ? { assigneeIds: body.assigneeIds } : {}),
      ...(body.assignmentStrategy !== undefined
        ? { assignmentStrategy: body.assignmentStrategy }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(facebookForms.id, id), eq(facebookForms.orgId, SINGLE_TENANT_ORG_ID)))
    .returning({
      id: facebookForms.id,
      formId: facebookForms.formId,
      name: facebookForms.name,
      isActive: facebookForms.isActive,
      isSelected: facebookForms.isSelected,
      projectId: facebookForms.projectId,
      pageId: facebookForms.pageId,
      assigneeIds: facebookForms.assigneeIds,
      assignmentStrategy: facebookForms.assignmentStrategy,
    });

  if (!row) return jsonError(c, "NOT_FOUND", "Form not found", 404);
  return jsonOk(c, row);
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
