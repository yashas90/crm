import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAssignmentHistory = vi.fn();
const getLeadById = vi.fn();

vi.mock("../services/leadAssignmentService.js", () => ({
  getAssignmentHistory,
}));

vi.mock("../services/leadService.js", () => ({
  leadService: {
    getLeadById,
  },
  LeadDuplicatePhoneError: class LeadDuplicatePhoneError extends Error {},
}));

const managerUser = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "manager@demo.test",
  name: "Manager",
  role: "manager" as const,
};

describe("GET /api/leads/:id/assignments", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { leadsRoute } = await import("../routes/leads.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", managerUser);
      await next();
    });
    app.route("/api/leads", leadsRoute);
  });

  it("returns assignment history for a lead", async () => {
    getLeadById.mockResolvedValue({
      id: "lead-1",
      assignedTo: "agent-1",
      firstName: "A",
      lastName: "Lead",
    });
    getAssignmentHistory.mockResolvedValue([
      {
        id: "assign-1",
        leadId: "lead-1",
        fromAgentId: null,
        fromAgentName: null,
        toAgentId: "agent-1",
        toAgentName: "Ravi",
        assignedBy: "manager-1",
        assignedByName: "Manager",
        reason: null,
        assignedAt: "2025-06-12T10:00:00.000Z",
      },
    ]);

    const res = await app.request("/api/leads/lead-1/assignments");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].toAgentName).toBe("Ravi");
    expect(getAssignmentHistory).toHaveBeenCalledWith("lead-1");
  });

  it("returns 404 when lead does not exist", async () => {
    getLeadById.mockResolvedValue(null);

    const res = await app.request("/api/leads/missing/assignments");
    expect(res.status).toBe(404);
  });
});
