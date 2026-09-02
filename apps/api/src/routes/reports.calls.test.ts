import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCallsReport = vi.fn();
const getCallsReportPerUser = vi.fn();
const listManagerTeamUserIds = vi.fn();

vi.mock("../services/reportService.js", () => ({
  reportService: {
    getCallsReport,
    getCallsReportPerUser,
    listManagerTeamUserIds,
    getTeamToday: vi.fn(),
    getDashboard: vi.fn(),
    getOverviewStats: vi.fn(),
    getProjects: vi.fn(),
  },
}));

const managerUser = {
  id: "00000000-0000-0000-0000-000000000004",
  email: "manager@demo.propninja",
  name: "Manager",
  role: "manager" as const,
  orgId: "00000000-0000-0000-0000-000000000001",
  isFirstLogin: false,
};

const adminUser = {
  ...managerUser,
  id: "00000000-0000-0000-0000-000000000002",
  role: "admin" as const,
  email: "admin@propninja.local",
  name: "Admin",
};

const agentOnTeam = "00000000-0000-4000-8000-000000000010";
const agentOffTeam = "00000000-0000-4000-8000-000000000099";

function buildApp(user: typeof managerUser) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("authUser", user);
    await next();
  });
  return app;
}

describe("GET /api/reports/calls manager scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listManagerTeamUserIds.mockResolvedValue([managerUser.id, agentOnTeam]);
    getCallsReportPerUser.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totals: {},
    });
    getCallsReport.mockResolvedValue({
      calls_over_time: [],
      disposition_breakdown: [],
      direction_breakdown: [],
      activity_on_leads_over_time: [],
    });
  });

  it("allows managers to load the per-user call report for their team", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(managerUser);
    app.route("/api/reports", reportsRoutes);

    const res = await app.request("/api/reports/calls?group_by=user");
    expect(res.status).toBe(200);
    expect(listManagerTeamUserIds).toHaveBeenCalledWith(managerUser.id);
    expect(getCallsReportPerUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [managerUser.id, agentOnTeam],
      }),
    );
  });

  it("rejects a manager filter for an agent outside their team", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(managerUser);
    app.route("/api/reports", reportsRoutes);

    const res = await app.request(`/api/reports/calls?group_by=user&user_ids=${agentOffTeam}`);
    expect(res.status).toBe(403);
    expect(getCallsReportPerUser).not.toHaveBeenCalled();
  });

  it("does not team-scope admins", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(adminUser);
    app.route("/api/reports", reportsRoutes);

    const res = await app.request("/api/reports/calls?group_by=user");
    expect(res.status).toBe(200);
    expect(listManagerTeamUserIds).not.toHaveBeenCalled();
    expect(getCallsReportPerUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: undefined,
      }),
    );
  });
});
