import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.fn().mockResolvedValue(undefined);
const insert = vi.fn(() => ({ values: insertValues }));
const execute = vi.fn();
const selectChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
};
selectChain.from.mockReturnValue(selectChain);
selectChain.where.mockReturnValue(selectChain);
selectChain.orderBy.mockResolvedValue([]);

vi.mock("@propninja/db", () => ({
  agentLocations: {
    id: "id",
    userId: "user_id",
    latitude: "latitude",
    longitude: "longitude",
    accuracy: "accuracy",
    capturedAt: "captured_at",
  },
  users: { id: "id", name: "name", email: "email" },
}));

vi.mock("../middleware/rateLimit.js", () => ({
  writeRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}));

import { locationRoutes } from "./locationRoutes.js";

function appWithUser(role: "admin" | "manager" | "agent") {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("authUser", {
      id: "11111111-1111-1111-1111-111111111111",
      role,
      email: "u@test.com",
      name: "Test",
      orgId: "00000000-0000-0000-0000-0000000000aa",
      isFirstLogin: false,
    });
    c.set("db", {
      insert,
      execute,
      select: () => selectChain,
    } as never);
    await next();
  });
  app.route("/api/locations", locationRoutes);
  return app;
}

describe("locationRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execute.mockResolvedValue([]);
    selectChain.orderBy.mockResolvedValue([]);
  });

  it("accepts a ping from any authenticated user", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 20,
        capturedAt: "2026-07-29T10:00:00.000Z",
      }),
    });
    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalled();
  });

  it("forbids live locations for agents", async () => {
    const app = appWithUser("agent");
    const res = await app.request("/api/locations/live");
    expect(res.status).toBe(403);
  });

  it("allows live locations for managers", async () => {
    execute.mockResolvedValue([
      {
        user_id: "11111111-1111-1111-1111-111111111111",
        latitude: 12.97,
        longitude: 77.59,
        accuracy: 15,
        captured_at: new Date("2026-07-29T10:00:00.000Z"),
        name: "A",
        email: "a@test.com",
      },
    ]);
    const app = appWithUser("manager");
    const res = await app.request("/api/locations/live");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { agents: unknown[] } };
    expect(json.ok).toBe(true);
    expect(json.data.agents).toHaveLength(1);
  });
});
