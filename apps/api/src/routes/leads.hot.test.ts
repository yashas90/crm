import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listHotLeads = vi.fn();

vi.mock("../services/leadService.js", () => ({
  leadService: {
    listOverdueLeads: vi.fn(),
    listColdLeads: vi.fn(),
    updateFollowUp: vi.fn(),
  },
  LeadDuplicatePhoneError: class LeadDuplicatePhoneError extends Error {},
}));

vi.mock("../services/leadScoringService.js", () => ({
  listHotLeads,
  getLeadScoreBreakdown: vi.fn(),
  recalculateLeadScore: vi.fn(),
}));

const agentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "agent@demo.test",
  name: "Agent",
  role: "agent" as const,
};

describe("GET /api/leads/hot", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { leadsRoute } = await import("../routes/leads.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      await next();
    });
    app.route("/api/leads", leadsRoute);
  });

  it("returns hot leads scoped to the agent", async () => {
    listHotLeads.mockResolvedValue([
      {
        id: "lead-1",
        firstName: "Priya",
        lastName: "Sharma",
        score: 85,
      },
    ]);

    const res = await app.request("/api/leads/hot");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].score).toBe(85);
    expect(listHotLeads).toHaveBeenCalledWith(agentUser.id, 50);
  });
});
