import { describe, expect, it } from "vitest";
import { LEAD_PURGE_AFTER_MS } from "./purgeExpiredLeads.js";

describe("LEAD_PURGE_AFTER_MS", () => {
  it("is 48 hours", () => {
    expect(LEAD_PURGE_AFTER_MS).toBe(48 * 60 * 60 * 1000);
  });
});
