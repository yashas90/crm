import { describe, expect, it } from "vitest";
import { seedDemoData } from "./seed.js";

describe("seedDemoData", () => {
  it("runs without throwing when DATABASE_URL is reachable", async ({ skip }) => {
    if (!process.env.DATABASE_URL) {
      skip();
    }

    await expect(seedDemoData()).resolves.toMatchObject({
      orgId: expect.any(String),
      leadCount: expect.any(Number),
    });
  });
});
