import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listCalls = vi.fn();
const getSummary = vi.fn();

vi.mock("../services/callService.js", () => ({
  callService: {
    listCalls,
    getSummary,
    logCall: vi.fn(),
  },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  callsLogRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
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

describe("GET /api/calls", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    listCalls.mockResolvedValue({
      items: [
        {
          id: "call-1",
          leadId: "lead-1",
          phoneNumber: "+919876543210",
          outcome: "answered",
          durationSeconds: 120,
          notes: "Interested",
          startedAt: new Date("2026-06-16T10:00:00.000Z"),
          lead: { id: "lead-1", firstName: "Jane", lastName: "Doe", phone: "+919876543210" },
          user: { id: agentUser.id, name: agentUser.name, email: agentUser.email },
        },
      ],
      page: 1,
      pageSize: 50,
      total: 1,
    });

    const { callsRoute } = await import("./calls.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", adminUser);
      await next();
    });
    app.route("/api/calls", callsRoute);
  });

  it("returns mobile-friendly calls array with leadName", async () => {
    const res = await app.request(
      "/api/calls?agentId=me&limit=50&page=1&outcome=answered&dateFrom=2026-06-16T00:00:00.000Z&dateTo=2026-06-16T23:59:59.999Z",
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: {
        calls: Array<{
          id: string;
          leadName: string;
          phone: string;
          outcome: string;
          duration: number;
          calledAt: string;
        }>;
        total: number;
        page: number;
        limit: number;
      };
    };

    expect(body.ok).toBe(true);
    expect(body.data.calls).toHaveLength(1);
    expect(body.data.calls[0]).toMatchObject({
      id: "call-1",
      leadName: "Jane Doe",
      phone: "+919876543210",
      outcome: "answered",
      duration: 2,
      calledAt: "2026-06-16T10:00:00.000Z",
      agentName: "Agent One",
    });
    expect(body.data.total).toBe(1);
    expect(body.data.limit).toBe(50);

    expect(listCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: adminUser.id,
        outcome: "answered",
        page: 1,
        pageSize: 50,
      }),
    );
  });

  it("scopes agent role to own user id regardless of agentId param", async () => {
    const { callsRoute } = await import("./calls.js");
    const agentApp = new Hono();
    agentApp.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      await next();
    });
    agentApp.route("/api/calls", callsRoute);

    const res = await agentApp.request("/api/calls?agentId=00000000-0000-4000-8000-000000000099");
    expect(res.status).toBe(200);
    expect(listCalls).toHaveBeenCalledWith(expect.objectContaining({ userId: agentUser.id }));
  });

  it("rejects invalid query params", async () => {
    const res = await app.request("/api/calls?outcome=invalid");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/calls/summary", () => {
  it("returns answered_calls in summary", async () => {
    getSummary.mockResolvedValue({
      total_calls: 10,
      completed_calls: 8,
      missed_calls: 2,
      answered_calls: 7,
      average_duration: 90,
      calls_by_user: [],
    });

    const { callsRoute } = await import("./calls.js");
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", adminUser);
      await next();
    });
    app.route("/api/calls", callsRoute);

    const res = await app.request("/api/calls/summary?agentId=me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { answered_calls: number } };
    expect(body.data.answered_calls).toBe(7);
  });
});
