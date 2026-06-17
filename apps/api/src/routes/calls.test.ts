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
  orgId: "00000000-0000-0000-0000-0000000000aa",
  isFirstLogin: false,
};

const agentUser = {
  id: "00000000-0000-0000-0000-000000000003",
  email: "agent1@demo.propninja",
  name: "Agent One",
  role: "agent" as const,
  orgId: "00000000-0000-0000-0000-0000000000aa",
  isFirstLogin: false,
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

  it("returns paginated call list", async () => {
    const res = await app.request(
      "/api/calls?user_id=00000000-0000-0000-0000-000000000003&page=1&pageSize=50&date_from=2026-06-16T00:00:00.000Z&date_to=2026-06-16T23:59:59.999Z",
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: {
        items: Array<{ id: string; phoneNumber: string; outcome: string }>;
        total: number;
        page: number;
        pageSize: number;
      };
    };

    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      id: "call-1",
      phoneNumber: "+919876543210",
      outcome: "answered",
    });
    expect(body.data.total).toBe(1);
    expect(body.data.pageSize).toBe(50);

    expect(listCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "00000000-0000-0000-0000-000000000003",
        page: 1,
        pageSize: 50,
      }),
    );
  });

  it("scopes agent role to own user id regardless of user_id param", async () => {
    const { callsRoute } = await import("./calls.js");
    const agentApp = new Hono();
    agentApp.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      await next();
    });
    agentApp.route("/api/calls", callsRoute);

    const res = await agentApp.request("/api/calls?user_id=00000000-0000-4000-8000-000000000099");
    expect(res.status).toBe(200);
    expect(listCalls).toHaveBeenCalledWith(expect.objectContaining({ userId: agentUser.id }));
  });

  it("rejects invalid query params", async () => {
    const res = await app.request("/api/calls?user_id=not-a-uuid");
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
    });

    const { callsRoute } = await import("./calls.js");
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", adminUser);
      await next();
    });
    app.route("/api/calls", callsRoute);

    const res = await app.request("/api/calls/summary");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { answered_calls: number } };
    expect(body.ok).toBe(true);
    expect(body.data.answered_calls).toBe(7);
  });
});
