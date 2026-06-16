import { afterEach, describe, expect, it, vi } from "vitest";

describe("resolveCorsOrigins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows production domains without wildcards", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ORIGINS", "https://www.ninjamarketing.in,https://ninjamarketing.in");

    const { resolveCorsOrigins } = await import("./cors.js");
    expect(resolveCorsOrigins()).toEqual([
      "https://www.ninjamarketing.in",
      "https://ninjamarketing.in",
    ]);
  });

  it("rejects wildcard origins in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ORIGINS", "*");

    const { resolveCorsOrigins } = await import("./cors.js");
    expect(() => resolveCorsOrigins()).toThrow(/wildcards/i);
  });

  it("includes localhost defaults in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CORS_ORIGINS", "");

    const { resolveCorsOrigins } = await import("./cors.js");
    expect(resolveCorsOrigins()).toEqual(["http://localhost:3000", "http://localhost:8081"]);
  });
});
