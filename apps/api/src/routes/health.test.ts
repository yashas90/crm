import { describe, expect, it } from "vitest";
import { healthRoutes } from "./health.js";

describe("GET /health", () => {
  it("returns ok status with version and timestamp", async () => {
    const res = await healthRoutes.request("/");
    expect([200, 503]).toContain(res.status);

    const body = (await res.json()) as {
      status: string;
      version: string;
      timestamp: string;
    };

    expect(body.status).toMatch(/^(ok|degraded)$/);
    expect(body.version).toBeTruthy();
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
