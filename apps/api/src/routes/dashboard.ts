import { Hono } from "hono";
import { z } from "zod";
import { ADMIN_DASHBOARD_PERIODS } from "../lib/adminDashboardPeriod.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { clearMorningBriefCache } from "../lib/responseCache.js";
import { validate } from "../lib/validate.js";
import { getAdminOverview, listDashboardTeamUserIds } from "../services/adminDashboardService.js";
import { buildMorningBrief, completeMorningCallback } from "../services/morningBriefService.js";

export const dashboardRoutes = new Hono();

const adminOverviewQuerySchema = z.object({
  period: z.enum(ADMIN_DASHBOARD_PERIODS).default("today"),
  source: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

const completeSchema = z.object({
  source: z.enum(["lead", "calling"]),
  id: z.string().uuid(),
});

dashboardRoutes.get("/morning-brief", async (c) => {
  const data = await buildMorningBrief(c.get("db"), c.get("authUser"));
  return jsonOk(c, data);
});

dashboardRoutes.post(
  "/morning-brief/callbacks/complete",
  validate("json", completeSchema),
  async (c) => {
    await completeMorningCallback(c.get("db"), c.get("authUser"), c.req.valid("json"));
    clearMorningBriefCache();
    return jsonOk(c, { done: true });
  },
);

/** Org sales dashboard. Admins see the whole book. Managers see their team. Agents are denied. */
dashboardRoutes.get("/admin-overview", async (c) => {
  const authUser = c.get("authUser");
  if (authUser.role !== "admin" && authUser.role !== "manager") {
    return jsonError(c, "FORBIDDEN", "Admin dashboard is limited to admins and managers", 403);
  }

  const parsed = adminOverviewQuerySchema.safeParse({
    period: c.req.query("period") ?? "today",
    source: c.req.query("source") || undefined,
  });
  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid dashboard period", 400);
  }

  const userIds =
    authUser.role === "admin" ? null : await listDashboardTeamUserIds(c.get("db"), authUser.id);

  const data = await getAdminOverview(c.get("db"), {
    period: parsed.data.period,
    source: parsed.data.source,
    userIds,
  });
  return jsonOk(c, data);
});
