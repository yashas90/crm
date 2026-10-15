import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listToday = vi.fn();
const list = vi.fn();
const create = vi.fn();
const getById = vi.fn();

vi.mock("../services/siteVisitService.js", () => ({
  siteVisitService: {
    listToday,
    list,
    create,
    getById,
    calendar: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
}));

vi.mock("../services/siteVisitTrackingService.js", () => ({
  siteVisitTrackingService: {
    onScheduled: vi.fn(),
    managerCanAccess: vi.fn(),
    checkIn: vi.fn(),
  },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../services/notificationService.js", () => ({
  NOTIFICATION_TYPES: { SITE_VISIT_SCHEDULED: "site_visit_scheduled" },
  createNotificationService: () => ({ createNotification: vi.fn() }),
}));

const getLeadById = vi.fn();

vi.mock("../services/leadService.js", () => ({
  leadService: { getLeadById },
}));

const agentUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "agent@demo.test",
  name: "Agent",
  role: "agent" as const,
};

describe("GET /api/site-visits/today", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { siteVisitsRoutes } = await import("../routes/siteVisits.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      c.set("db", {});
      await next();
    });
    app.route("/api/site-visits", siteVisitsRoutes);
  });

  it("returns today's visits for the requesting agent", async () => {
    listToday.mockResolvedValue({
      items: [
        {
          id: "visit-1",
          visitDate: "2026-06-16",
          visitTime: "10:00:00",
          status: "scheduled",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 100,
    });

    const res = await app.request("/api/site-visits/today");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(listToday).toHaveBeenCalledWith(agentUser.id);
  });
});

describe("POST /api/site-visits overlap", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    getLeadById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000010",
      assignedTo: agentUser.id,
      phone: "+919876543210",
    });
    const { siteVisitsRoutes } = await import("../routes/siteVisits.js");
    const { SiteVisitOverlapError } = await import("../lib/siteVisitTime.js");
    create.mockRejectedValue(new SiteVisitOverlapError());

    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      c.set("db", {});
      await next();
    });
    app.route("/api/site-visits", siteVisitsRoutes);
  });

  it("returns 409 when visits overlap", async () => {
    const res = await app.request("/api/site-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: "00000000-0000-4000-8000-000000000010",
        visitDate: "2026-12-16",
        visitTime: "10:00",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VISIT_OVERLAP");
  });
});

describe("POST /api/site-visits/:id/check-in", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { siteVisitsRoutes } = await import("../routes/siteVisits.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", agentUser);
      c.set("db", {});
      await next();
    });
    app.route("/api/site-visits", siteVisitsRoutes);
  });

  it("returns 403 when an agent checks in another agent's visit", async () => {
    getById.mockResolvedValue({
      id: "visit-1",
      agentId: "00000000-0000-4000-8000-000000000099",
      visitDate: "2026-12-16",
      visitTime: "10:00:00",
      status: "scheduled",
    });

    const res = await app.request("/api/site-visits/visit-1/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 28.6, lng: 77.2 }),
    });

    expect(res.status).toBe(403);
  });

  it("returns 400 when check-in is earlier than 30 minutes before the visit", async () => {
    getById.mockResolvedValue({
      id: "visit-1",
      agentId: agentUser.id,
      visitDate: "2026-12-20",
      visitTime: "10:00:00",
      status: "scheduled",
    });

    const res = await app.request("/api/site-visits/visit-1/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 28.6, lng: 77.2 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("CHECKIN_TOO_EARLY");
  });
});
