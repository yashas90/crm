import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listOverdueLeads = vi.fn();

vi.mock("../services/leadService.js", () => ({
  leadService: {
    listOverdueLeads,
    listColdLeads: vi.fn(),
    updateFollowUp: vi.fn(),
  },
  LeadDuplicatePhoneError: class LeadDuplicatePhoneError extends Error {},
}));

const agentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "agent@demo.test",
  name: "Agent",
  role: "agent" as const,
};

describe("GET /api/leads/overdue", () => {
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

  it("returns overdue leads scoped to the agent", async () => {
    listOverdueLeads.mockResolvedValue([
      {
        id: "lead-1",
        firstName: "A",
        lastName: "B",
        daysOverdue: 2,
      },
    ]);

    const res = await app.request("/api/leads/overdue");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(listOverdueLeads).toHaveBeenCalledWith(agentUser.id);
  });
});
