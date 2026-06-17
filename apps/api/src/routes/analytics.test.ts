import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetResponseCacheForTests } from "../lib/responseCache.js";

const getOverview = vi.fn();

vi.mock("../services/analyticsService.js", () => ({
  analyticsService: { getOverview },
}));

const adminUser = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "admin@propninja.local",
  name: "Admin",
  role: "admin" as const,
};

const agentUser = {
  id: "00000000-0000-0000-0000-000000000003",
  email: "agent1@demo.propninja",
  name: "Agent One",
  role: "agent" as const,
};

const mockOverview = {
  period: {
    dateFrom: "2026-06-01T00:00:00.000Z",
    dateTo: "2026-06-16T23:59:59.999Z",
    previousFrom: "2026-05-16T00:00:00.000Z",
    previousTo: "2026-05-31T23:59:59.999Z",
  },
  kpis: {
    totalLeads: { value: 10, previousValue: 8, changePercent: 25 },
    leadsContacted: { value: 7, previousValue: 5, changePercent: 40 },
    siteVisitsScheduled: { value: 3, previousValue: 2, changePercent: 50 },
    siteVisitsCompleted: { value: 2, previousValue: 1, changePercent: 100 },
    leadsWon: { value: 1, previousValue: 0, changePercent: 100 },
    conversionRate: { value: 10, previousValue: 0, changePercent: 100 },
    totalCalls: { value: 42, previousValue: 30, changePercent: 40 },
    avgResponseTimeHours: { value: 4.5, previousValue: 6, changePercent: -25 },
  },
  charts: {
    leadsOverTime: [],
    leadFunnel: [],
    callsByOutcome: [],
    leadSources: [],
  },
  leaderboard: [],
  health: {
    coldLeads: { count: 0, preview: [] },
    overdueFollowUps: { count: 0, preview: [] },
    unassignedLeads: { count: 0, leadIds: [], preview: [] },
    stalePipeline: { count: 0, preview: [] },
  },
};

describe("GET /api/analytics/overview", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetResponseCacheForTests();
    getOverview.mockResolvedValue(mockOverview);

    const { analyticsRoutes } = await import("./analytics.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", adminUser);
      await next();
    });
    app.route("/api/analytics", analyticsRoutes);
  });

  it("returns analytics overview for admin", async () => {
    const res = await app.request(
      "/api/analytics/overview?dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-16T23:59:59.999Z",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: typeof mockOverview };
    expect(body.ok).toBe(true);
    expect(body.data.kpis.totalLeads.value).toBe(10);
    expect(getOverview).toHaveBeenCalledOnce();
  });

  it("denies agents", async () => {
    const { analyticsRoutes } = await import("./analytics.js");
    const agentApp = new Hono();
    agentApp.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      await next();
    });
    agentApp.route("/api/analytics", analyticsRoutes);

    const res = await agentApp.request("/api/analytics/overview");
    expect(res.status).toBe(403);
  });

  it("POST /overview/refresh clears user cache and returns fresh data", async () => {
    const res = await app.request("/api/analytics/overview/refresh", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: typeof mockOverview };
    expect(body.ok).toBe(true);
    expect(body.data.kpis.totalLeads.value).toBe(10);
    expect(getOverview).toHaveBeenCalledOnce();
  });
});
