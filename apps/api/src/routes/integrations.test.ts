import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

const syncGoogleAdsLeads = vi.fn(async () => ({ ingested: 2, failed: 0, skipped: false }));

vi.mock("../jobs/googleAdsLeadJob.js", () => ({
  syncGoogleAdsLeads,
}));

vi.mock("../lib/integrationsStatus.js", () => ({
  getIntegrationsStatus: vi.fn(async () => ({
    facebook: { status: "not_configured", enabled: false },
    googleAds: { status: "live", enabled: true, syncEnabled: true },
  })),
}));

vi.mock("../middleware/rateLimit.js", () => ({
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

describe("integrations routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("POST /google/poll requires admin", async () => {
    const { integrationsRoutes } = await import("./integrations.js");
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", { id: "u1", role: "agent", email: "a@test.com", name: "Agent" });
      await next();
    });
    app.route("/api/integrations", integrationsRoutes);

    const res = await app.request("/api/integrations/google/poll", { method: "POST" });
    expect(res.status).toBe(403);
    expect(syncGoogleAdsLeads).not.toHaveBeenCalled();
  });

  it("POST /google/poll triggers sync for admin", async () => {
    const { integrationsRoutes } = await import("./integrations.js");
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", { id: "u1", role: "admin", email: "a@test.com", name: "Admin" });
      await next();
    });
    app.route("/api/integrations", integrationsRoutes);

    const res = await app.request("/api/integrations/google/poll", { method: "POST" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { ingested: number } };
    expect(json.data.ingested).toBe(2);
    expect(syncGoogleAdsLeads).toHaveBeenCalledOnce();
  });
});
