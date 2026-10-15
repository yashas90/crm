import { describe, expect, it } from "vitest";
import app from "../index.js";

describe("morning brief auth", () => {
  it("GET /api/dashboard/morning-brief requires authentication", async () => {
    const res = await app.request("/api/dashboard/morning-brief");
    expect(res.status).toBe(401);
  });

  it("POST callback complete requires authentication", async () => {
    const res = await app.request("/api/dashboard/morning-brief/callbacks/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "lead",
        id: "00000000-0000-4000-8000-000000000001",
      }),
    });
    expect(res.status).toBe(401);
  });
});
