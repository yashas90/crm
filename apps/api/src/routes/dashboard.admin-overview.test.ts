import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminOverview = vi.fn();
const listDashboardTeamUserIds = vi.fn();

vi.mock("../services/adminDashboardService.js", () => ({
  getAdminOverview,
  listDashboardTeamUserIds,
}));

const adminUser = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "admin@propninja.local",
  name: "Asha Admin",
  role: "admin" as const,
  orgId: "00000000-0000-0000-0000-0000000000aa",
  isFirstLogin: false,
};

const managerUser = {
  ...adminUser,
  id: "00000000-0000-0000-0000-000000000004",
  role: "manager" as const,
  name: "Mina Manager",
};

const agentUser = {
  ...adminUser,
  id: "00000000-0000-0000-0000-000000000003",
  role: "agent" as const,
  name: "Agent One",
};

const overview = {
  period: "today",
  label: "Today",
  scope: "org",
  source: null,
  range: { from: "2026-10-15T00:00:00.000Z", to: "2026-10-15T18:29:59.999Z" },
  revenue: {
    total: { amount: 0, changePercent: 0, sparkline: [0, 0] },
    today: { amount: 0, changePercent: 0, sparkline: [0, 0] },
    last7Days: { amount: 0, changePercent: 0, sparkline: [0, 0] },
    last30Days: { amount: 0, changePercent: 0, sparkline: [0, 0] },
    lastQuarter: { amount: 0, changePercent: 0, sparkline: [0, 0] },
  },
  leadsReceived: { total: 0, active: 0, lost: 0, byStatus: [] },
  sources: [],
  sourceOptions: [],
  funnel: [],
  topClosers: [],
  drivers: {
    newLeads: { count: 0, previous: 0, changePercent: 0 },
    siteVisits: { count: 0, previous: 0, changePercent: 0 },
    closed: { count: 0, previous: 0, changePercent: 0 },
    pending: { count: 0, previous: 0, changePercent: 0 },
  },
  reminders: [],
  agentTalktime: [],
};

function appFor(user: typeof adminUser) {
  return async () => {
    const { dashboardRoutes } = await import("./dashboard.js");
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", user);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/dashboard", dashboardRoutes);
    return app;
  };
}

describe("GET /api/dashboard/admin-overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminOverview.mockResolvedValue(overview);
    listDashboardTeamUserIds.mockResolvedValue([managerUser.id]);
  });

  it("returns the org overview for an admin", async () => {
    const app = await appFor(adminUser)();
    const res = await app.request("/api/dashboard/admin-overview?period=7d");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { period: string; scope: string } };
    expect(body.ok).toBe(true);
    expect(body.data.period).toBe("today");
    expect(getAdminOverview).toHaveBeenCalledWith(expect.anything(), {
      period: "7d",
      source: undefined,
      userIds: null,
    });
    expect(listDashboardTeamUserIds).not.toHaveBeenCalled();
  });

  it("scopes a manager to their team", async () => {
    const app = await appFor(managerUser)();
    const res = await app.request("/api/dashboard/admin-overview?source=Meta%20Ads");
    expect(res.status).toBe(200);
    expect(listDashboardTeamUserIds).toHaveBeenCalledWith(expect.anything(), managerUser.id);
    expect(getAdminOverview).toHaveBeenCalledWith(expect.anything(), {
      period: "today",
      source: "Meta Ads",
      userIds: [managerUser.id],
    });
  });

  it("denies agents", async () => {
    const app = await appFor(agentUser)();
    const res = await app.request("/api/dashboard/admin-overview");
    expect(res.status).toBe(403);
    expect(getAdminOverview).not.toHaveBeenCalled();
  });

  it("rejects an unknown period", async () => {
    const app = await appFor(adminUser)();
    const res = await app.request("/api/dashboard/admin-overview?period=year");
    expect(res.status).toBe(400);
    expect(getAdminOverview).not.toHaveBeenCalled();
  });
});
