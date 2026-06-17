import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAgentStats = vi.fn();

vi.mock("../services/reportService.js", () => ({
  reportService: {
    getAgentStats,
    getTeamToday: vi.fn(),
  },
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

const otherAgentId = "00000000-0000-4000-8000-000000000099";

const mockStats = {
  today: {
    callsMade: 5,
    callsAnswered: 3,
    callsAnsweredPercent: 60,
    leadsContacted: 4,
    tasksCompleted: 2,
    newLeadsAssigned: 1,
    followUpsDone: 1,
  },
  thisMonth: {
    totalCalls: 42,
    answeredPercent: 78,
    avgCallDurationMinutes: 3,
    leadsConverted: 3,
    leadsAssigned: 10,
    leadsContacted: 8,
    leadsAssignedVsContactedRatio: 80,
    tasksCompleted: 12,
    tasksOverdue: 1,
    bestDay: { date: "2026-06-10", calls: 8 },
  },
  callsLast7Days: [{ date: "2026-06-16", count: 5 }],
  leaderboard: {
    rank: 2,
    totalAgents: 8,
    metric: "callsThisMonth" as const,
    entries: [],
  },
};

describe("GET /api/reports/agent-stats", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    getAgentStats.mockResolvedValue(mockStats);

    const { reportsRoutes } = await import("./reports.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      await next();
    });
    app.route("/api/reports", reportsRoutes);
  });

  it("returns agent stats for the authenticated agent", async () => {
    const res = await app.request("/api/reports/agent-stats");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: typeof mockStats };
    expect(body.ok).toBe(true);
    expect(body.data.today.callsMade).toBe(5);
    expect(body.data.thisMonth.totalCalls).toBe(42);
    expect(getAgentStats).toHaveBeenCalledWith(agentUser.id);
  });

  it("forbids agents from requesting another agent's stats", async () => {
    const res = await app.request(`/api/reports/agent-stats?agentId=${otherAgentId}`);
    expect(res.status).toBe(403);
    expect(getAgentStats).not.toHaveBeenCalled();
  });

  it("allows managers to request a specific agent's stats", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const managerApp = new Hono();
    managerApp.use("*", async (c, next) => {
      c.set("authUser", { ...adminUser, role: "manager" as const });
      await next();
    });
    managerApp.route("/api/reports", reportsRoutes);

    const res = await managerApp.request(`/api/reports/agent-stats?agentId=${otherAgentId}`);
    expect(res.status).toBe(200);
    expect(getAgentStats).toHaveBeenCalledWith(otherAgentId);
  });

  it("rejects invalid agentId", async () => {
    const res = await app.request("/api/reports/agent-stats?agentId=not-a-uuid");
    expect(res.status).toBe(400);
  });
});
