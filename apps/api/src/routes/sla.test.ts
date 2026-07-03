import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetResponseCacheForTests } from "../lib/responseCache.js";

const listBreached = vi.fn();
const getSummary = vi.fn();

vi.mock("../services/slaService.js", () => ({
  SLA_DEFAULT_INACTIVE_DAYS: 3,
  SLA_THRESHOLD_DAYS: [1, 3, 7, 14],
  slaService: { listBreached, getSummary },
}));

const adminUser = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "admin@propninja.local",
  name: "Admin",
  role: "admin" as const,
  orgId: "00000000-0000-0000-0000-0000000000aa",
  isFirstLogin: false,
};

describe("sla routes", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetResponseCacheForTests();
    listBreached.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      inactiveDays: 3,
    });
    getSummary.mockResolvedValue({
      inactive_1d: 1,
      inactive_3d: 2,
      inactive_7d: 3,
      inactive_14d: 4,
      flagged: 1,
      defaultInactiveDays: 3,
      thresholds: [1, 3, 7, 14],
    });

    const { slaRoutes } = await import("./sla.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", adminUser);
      await next();
    });
    app.route("/api/sla", slaRoutes);
  });

  it("GET /config returns thresholds", async () => {
    const res = await app.request("/api/sla/config");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { defaultInactiveDays: number } };
    expect(json.data.defaultInactiveDays).toBe(3);
  });

  it("GET /summary delegates to service", async () => {
    const res = await app.request("/api/sla/summary");
    expect(res.status).toBe(200);
    expect(getSummary).toHaveBeenCalledWith(undefined);
    const json = (await res.json()) as { data: { inactive_3d: number } };
    expect(json.data.inactive_3d).toBe(2);
  });

  it("GET /breached validates and lists", async () => {
    const res = await app.request("/api/sla/breached?inactiveDays=7&page=1&pageSize=10");
    expect(res.status).toBe(200);
    expect(listBreached).toHaveBeenCalledWith(
      expect.objectContaining({ inactiveDays: 7, page: 1, pageSize: 10 }),
    );
  });
});
