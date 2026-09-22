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

const agentId = "00000000-0000-4000-8000-000000000010";

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
    listManagerTeamUserIds.mockResolvedValue([managerUser.id]);
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

  it("lets managers load every employee's per-user call report", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(managerUser);
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

  it("lets managers filter the call report by any employee", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(managerUser);
    app.route("/api/reports", reportsRoutes);

    const res = await app.request(`/api/reports/calls?group_by=user&user_ids=${agentId}`);
    expect(res.status).toBe(200);
    expect(getCallsReportPerUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [agentId],
      }),
    );
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
