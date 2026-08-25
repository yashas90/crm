import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCacheKey,
  getCachedResponse,
  resetResponseCacheForTests,
  setCachedResponse,
} from "../lib/responseCache.js";

const listCalls = vi.fn();
const getSummary = vi.fn();
const logCall = vi.fn();
const getLeadById = vi.fn();

vi.mock("../services/callService.js", () => ({
  callService: {
    listCalls,
    getSummary,
    logCall,
  },
}));

vi.mock("../services/leadService.js", () => ({
  leadService: {
    getLeadById,
  },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  callsLogRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../lib/permissions.js", () => ({
  canEditLead: () => true,
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

const leadId = "00000000-0000-4000-8000-0000000000aa";

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

describe("POST /api/calls/log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetResponseCacheForTests();
    getLeadById.mockResolvedValue({
      id: leadId,
      phone: "+919876543210",
      assignedTo: agentUser.id,
    });
    logCall.mockResolvedValue({
      id: "call-new",
      leadId,
      phoneNumber: "+919876543210",
      outcome: "answered",
      followUpTask: null,
    });
  });

  it("clears report/lead caches so call counts are not stuck for 5–10 minutes", async () => {
    const statsKey = buildCacheKey("/api/reports/agent-stats", agentUser.id, "");
    const leadsKey = buildCacheKey("/api/leads", agentUser.id, "");
    setCachedResponse(statsKey, { today: { callsMade: 0 } }, 600);
    setCachedResponse(leadsKey, { items: [] }, 15);

    const { callsRoute } = await import("./calls.js");
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      await next();
    });
    app.route("/api/calls", callsRoute);

    const endedAt = new Date("2026-06-16T10:01:00.000Z");
    const startedAt = new Date("2026-06-16T10:00:00.000Z");
    const res = await app.request("/api/calls/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: leadId,
        phone_number: "+919876543210",
        duration_seconds: 60,
        outcome: "answered",
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        source: "mobile-auto",
      }),
    });

    expect(res.status).toBe(201);
    expect(logCall).toHaveBeenCalled();
    expect(getCachedResponse(statsKey)).toBeUndefined();
    expect(getCachedResponse(leadsKey)).toBeUndefined();
  });
});
