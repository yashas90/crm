import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type RateLimitBackend,
  incrementRateLimit,
  resetRateLimitStoreForTests,
} from "../lib/rateLimitStore.js";
import type { AuthUser } from "./auth.js";
import { createIpRateLimiter, createUserRateLimiter } from "./rateLimit.js";

const testUser: AuthUser = {
  id: "00000000-0000-0000-0000-000000000099",
  role: "agent",
  email: "agent@test.local",
  name: "Test Agent",
};

function appWithUser(limiter: ReturnType<typeof createUserRateLimiter>) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("authUser", testUser);
    await next();
  });
  app.post("/test", limiter, (c) => c.json({ ok: true }));
  return app;
}

describe("createUserRateLimiter", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
  });

  it("returns 429 after limit+1 calls in the same window", async () => {
    const limiter = createUserRateLimiter({ limit: 3, windowMs: 60_000, bucket: "test" });
    const app = appWithUser(limiter);

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/test", { method: "POST" });
      expect(res.status).toBe(200);
    }

    const blocked = await app.request("/test", { method: "POST" });
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("uses separate buckets per route", async () => {
    const limiterA = createUserRateLimiter({ limit: 1, windowMs: 60_000, bucket: "bucket-a" });
    const limiterB = createUserRateLimiter({ limit: 1, windowMs: 60_000, bucket: "bucket-b" });
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("authUser", testUser);
      await next();
    });
    app.post("/a", limiterA, (c) => c.json({ route: "a" }));
    app.post("/b", limiterB, (c) => c.json({ route: "b" }));

    expect((await app.request("/a", { method: "POST" })).status).toBe(200);
    expect((await app.request("/a", { method: "POST" })).status).toBe(429);
    expect((await app.request("/b", { method: "POST" })).status).toBe(200);
  });
});

describe("createIpRateLimiter", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
  });

  it("limits by client IP", async () => {
    const limiter = createIpRateLimiter({ limit: 2, windowMs: 60_000, bucket: "login-test" });
    const app = new Hono();
    app.post("/login", limiter, (c) => c.json({ ok: true }));

    const headers = { "x-forwarded-for": "203.0.113.10" };

    expect((await app.request("/login", { method: "POST", headers })).status).toBe(200);
    expect((await app.request("/login", { method: "POST", headers })).status).toBe(200);
    expect((await app.request("/login", { method: "POST", headers })).status).toBe(429);
  });
});

describe("Redis rate limit backend", () => {
  it("increments atomically via a mocked Redis backend", async () => {
    class MockRedisBackend implements RateLimitBackend {
      private counts = new Map<string, number>();

      increment(key: string, _windowSec: number): Promise<number> {
        const next = (this.counts.get(key) ?? 0) + 1;
        this.counts.set(key, next);
        return Promise.resolve(next);
      }
    }

    const store = new MockRedisBackend();
    const key = "rl:user-1:leads:post";
    const limit = 3;

    for (let i = 0; i < limit; i++) {
      const count = await incrementRateLimit(key, 60_000, store);
      expect(count).toBe(i + 1);
      expect(count).toBeLessThanOrEqual(limit);
    }

    const over = await incrementRateLimit(key, 60_000, store);
    expect(over).toBe(limit + 1);
    expect(over).toBeGreaterThan(limit);
  });
});
