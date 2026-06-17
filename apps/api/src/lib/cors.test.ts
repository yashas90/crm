import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveCorsOrigins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("./env.js");
  });

  it("allows production domains without wildcards", async () => {
    vi.stubEnv("CORS_ORIGINS", "https://www.ninjamarketing.in,https://ninjamarketing.in");
    vi.doMock("./env.js", () => ({ env: { NODE_ENV: "production" as const } }));

    const { resolveCorsOrigins } = await import("./cors.js");
    expect(resolveCorsOrigins()).toEqual([
      "https://www.ninjamarketing.in",
      "https://ninjamarketing.in",
    ]);
  });

  it("rejects wildcard origins in production", async () => {
    vi.stubEnv("CORS_ORIGINS", "*");
    vi.doMock("./env.js", () => ({ env: { NODE_ENV: "production" as const } }));

    const { resolveCorsOrigins } = await import("./cors.js");
    expect(() => resolveCorsOrigins()).toThrow(/wildcards/i);
  });

  it("includes localhost defaults in development", async () => {
    vi.stubEnv("CORS_ORIGINS", "");
    vi.doMock("./env.js", () => ({ env: { NODE_ENV: "development" as const } }));

    const { resolveCorsOrigins } = await import("./cors.js");
    expect(resolveCorsOrigins()).toEqual(["http://localhost:3000", "http://localhost:8081"]);
  });
});
