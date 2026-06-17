import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRevenuePipeline = vi.fn();
const exportCsv = vi.fn();

vi.mock("../services/revenuePipelineService.js", () => ({
  revenuePipelineService: {
    getRevenuePipeline,
    exportCsv,
  },
}));

const adminUser = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "admin@propninja.local",
  name: "Admin",
  role: "admin" as const,
};

const managerUser = {
  id: "00000000-0000-0000-0000-000000000004",
  email: "manager@demo.propninja",
  name: "Manager",
  role: "manager" as const,
};

const agentUser = {
  id: "00000000-0000-0000-0000-000000000003",
  email: "agent1@demo.propninja",
  name: "Agent One",
  role: "agent" as const,
};

const mockReport = {
  totalPipelineValue: 5_000_000,
  confirmedRevenue: 0,
  projectedRevenue: 1_200_000,
  byProject: [],
  byStage: [],
  wonThisPeriod: 0,
  lostThisPeriod: 0,
  conversionRate: null,
};

function buildApp(user: typeof adminUser) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("authUser", user);
    await next();
  });
  return app;
}

describe("GET /api/reports/revenue-pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRevenuePipeline.mockResolvedValue(mockReport);
    exportCsv.mockResolvedValue(new ReadableStream());
  });

  it("returns revenue pipeline for admin", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(adminUser);
    app.route("/api/reports", reportsRoutes);

    const res = await app.request(
      "/api/reports/revenue-pipeline?dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-30T23:59:59.999Z",
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof mockReport };
    expect(body.data.confirmedRevenue).toBe(0);
    expect(getRevenuePipeline).toHaveBeenCalledOnce();
  });

  it("allows manager access", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(managerUser);
    app.route("/api/reports", reportsRoutes);

    const res = await app.request("/api/reports/revenue-pipeline");
    expect(res.status).toBe(200);
  });

  it("denies agents with 403", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(agentUser);
    app.route("/api/reports", reportsRoutes);

    const res = await app.request("/api/reports/revenue-pipeline");
    expect(res.status).toBe(403);
    expect(getRevenuePipeline).not.toHaveBeenCalled();
  });

  it("passes date range and projectId to service", async () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(adminUser);
    app.route("/api/reports", reportsRoutes);

    await app.request(
      `/api/reports/revenue-pipeline?dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-15T23:59:59.999Z&projectId=${projectId}`,
    );

    expect(getRevenuePipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        dateFrom: expect.any(Date),
        dateTo: expect.any(Date),
      }),
    );
  });
});

describe("GET /api/reports/revenue-pipeline/export", () => {
  it("returns CSV for admin", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(adminUser);
    app.route("/api/reports", reportsRoutes);

    const res = await app.request("/api/reports/revenue-pipeline/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(exportCsv).toHaveBeenCalledOnce();
  });

  it("denies agents export", async () => {
    const { reportsRoutes } = await import("./reports.js");
    const app = buildApp(agentUser);
    app.route("/api/reports", reportsRoutes);

    const res = await app.request("/api/reports/revenue-pipeline/export");
    expect(res.status).toBe(403);
  });
});
