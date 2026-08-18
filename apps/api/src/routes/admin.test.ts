import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { clearAllResponseCaches } from "../lib/responseCache.js";
import { adminRoutes } from "./admin.js";

const adminUser = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "admin@propninja.local",
  name: "Admin",
  role: "admin" as const,
};

const managerUser = {
  id: "00000000-0000-0000-0000-000000000004",
  email: "manager@propninja.local",
  name: "Manager",
  role: "manager" as const,
};

function appFor(user: typeof adminUser) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("authUser", user);
    await next();
  });
  app.route("/", adminRoutes);
  return app;
}

describe("admin cache routes", () => {
  beforeEach(() => {
    clearAllResponseCaches();
  });

  it("POST /cache/clear requires admin", async () => {
    const res = await appFor(managerUser).request("/cache/clear", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("POST /cache/clear flushes caches for admin", async () => {
    const res = await appFor(adminUser).request("/cache/clear", { method: "POST" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { cleared: number } };
    expect(json.ok).toBe(true);
    expect(json.data.cleared).toBeGreaterThanOrEqual(0);
  });

  it("POST /leads/:id/apply-shamanth-history requires admin", async () => {
    const res = await appFor(managerUser).request("/leads/lead-1/apply-shamanth-history", {
      method: "POST",
    });
    expect(res.status).toBe(403);
  });
});
