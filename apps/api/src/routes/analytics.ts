import { Hono } from "hono";
import { jsonOk } from "../lib/response.js";
import {
  CACHE_TTL,
  applyCacheControlHeaders,
  buildCacheKey,
  clearAnalyticsCacheForUser,
  resolveCacheHeaderType,
  setCachedResponse,
} from "../lib/responseCache.js";
import { analyticsOverviewQuerySchema } from "../lib/validators/analytics.js";
import type { AuthUser } from "../middleware/auth.js";
import { analyticsService } from "../services/analyticsService.js";
import { createBookingDocumentService } from "../services/bookingDocumentService.js";

export const analyticsRoutes = new Hono();

function requireAnalyticsAccess(c: {
  get: (key: "authUser") => AuthUser;
  json: (body: unknown, status?: number) => Response;
}) {
  const authUser = c.get("authUser") as AuthUser;

  if (authUser.role !== "admin" && authUser.role !== "manager") {
    return c.json(
      { ok: false, error: { code: "FORBIDDEN", message: "Analytics access denied" } },
      403,
    );
  }

  return null;
}

analyticsRoutes.get("/overview", async (c) => {
  const denied = requireAnalyticsAccess(c);
  if (denied) return denied;

  const parsed = analyticsOverviewQuerySchema.safeParse({
    date_from: c.req.query("dateFrom") ?? c.req.query("date_from"),
    date_to: c.req.query("dateTo") ?? c.req.query("date_to"),
  });

  if (!parsed.success) {
    return c.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      400,
    );
  }

  const data = await analyticsService.getOverview(parsed.data);
  return c.json({ ok: true, data });
});

analyticsRoutes.get("/booked-units", async (c) => {
  const denied = requireAnalyticsAccess(c);
  if (denied) return denied;

  const parsed = analyticsOverviewQuerySchema.safeParse({
    date_from: c.req.query("dateFrom") ?? c.req.query("date_from"),
    date_to: c.req.query("dateTo") ?? c.req.query("date_to"),
  });

  if (!parsed.success) {
    return c.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      400,
    );
  }

  const { dateFrom, dateTo } = parsed.data;
  const bookingService = createBookingDocumentService(c.get("db"));
  const items = await bookingService.listInRange(dateFrom, dateTo);
  return c.json({ ok: true, data: { items } });
});

/** Busts cached overview for the current user and returns fresh data. */
analyticsRoutes.post("/overview/refresh", async (c) => {
  const denied = requireAnalyticsAccess(c);
  if (denied) return denied;

  const authUser = c.get("authUser") as AuthUser;
  clearAnalyticsCacheForUser(authUser.id);

  const parsed = analyticsOverviewQuerySchema.safeParse({
    date_from: c.req.query("dateFrom") ?? c.req.query("date_from"),
    date_to: c.req.query("dateTo") ?? c.req.query("date_to"),
  });

  if (!parsed.success) {
    return c.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      400,
    );
  }

  const data = await analyticsService.getOverview(parsed.data);
  const queryString = new URL(c.req.url).searchParams.toString();
  const cacheKey = buildCacheKey("/api/analytics/overview", authUser.id, queryString);
  setCachedResponse(cacheKey, { ok: true as const, data }, CACHE_TTL.analytics);

  applyCacheControlHeaders(c, resolveCacheHeaderType("/api/analytics/overview"));
  return jsonOk(c, data);
});
