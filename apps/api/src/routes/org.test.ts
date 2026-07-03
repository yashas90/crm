import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canViewOrgProfile: vi.fn(),
  canUpdateOrgProfile: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  auditFromContext: vi.fn(),
}));

vi.mock("../lib/permissions.js", () => ({
  canViewOrgProfile: mocks.canViewOrgProfile,
  canUpdateOrgProfile: mocks.canUpdateOrgProfile,
}));

vi.mock("../services/orgService.js", () => ({
  createOrgService: () => ({
    get: mocks.get,
    update: mocks.update,
  }),
}));

vi.mock("../services/auditService.js", () => ({
  auditFromContext: mocks.auditFromContext,
}));

vi.mock("../middleware/rateLimit.js", () => ({
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

const adminUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@demo.test",
  name: "Admin",
  role: "admin" as const,
};

describe("org routes", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.canViewOrgProfile.mockReturnValue(true);
    mocks.canUpdateOrgProfile.mockReturnValue(true);
    mocks.get.mockResolvedValue({
      id: "org-1",
      name: "Demo Org",
      slug: "demo",
      settings: {},
      createdAt: new Date().toISOString(),
    });
    mocks.update.mockResolvedValue({
      id: "org-1",
      name: "Updated Org",
      slug: "demo",
      settings: { website: "https://demo.example" },
      createdAt: new Date().toISOString(),
    });
    mocks.auditFromContext.mockResolvedValue(undefined);

    const { orgRoutes } = await import("../routes/org.js");
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", adminUser);
      c.set("db", {});
      await next();
    });
    app.route("/api/org", orgRoutes);
  });

  it("GET /api/org returns organization for authorized users", async () => {
    const res = await app.request("/api/org");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe("Demo Org");
    expect(mocks.get).toHaveBeenCalled();
  });

  it("GET /api/org returns 403 when user cannot view org profile", async () => {
    mocks.canViewOrgProfile.mockReturnValue(false);
    const res = await app.request("/api/org");
    expect(res.status).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("PATCH /api/org updates organization and writes audit log", async () => {
    const res = await app.request("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Org",
        website: "https://demo.example",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe("Updated Org");
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.auditFromContext).toHaveBeenCalled();
  });

  it("PATCH /api/org returns 403 for users without update permission", async () => {
    mocks.canUpdateOrgProfile.mockReturnValue(false);
    const res = await app.request("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(res.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
