import { describe, expect, it } from "vitest";
import { NEW_LEAD_MAX_AGE_MS, isFreshNewLead, newLeadFreshnessCutoff } from "./ageOutNewLeads.js";

describe("isFreshNewLead", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");

  it("keeps new leads within 24h in New", () => {
    expect(
      isFreshNewLead({
        leadStatus: "new",
        createdAt: "2026-07-28T01:00:00.000Z",
        now,
      }),
    ).toBe(true);
  });

  it("excludes new leads older than 24h", () => {
    expect(
      isFreshNewLead({
        leadStatus: "new",
        createdAt: "2026-07-27T11:00:00.000Z",
        now,
      }),
    ).toBe(false);
  });

  it("excludes non-new statuses regardless of age", () => {
    expect(
      isFreshNewLead({
        leadStatus: "contacted",
        createdAt: "2026-07-28T11:00:00.000Z",
        now,
      }),
    ).toBe(false);
  });

  it("uses a 24h cutoff", () => {
    expect(NEW_LEAD_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
    expect(newLeadFreshnessCutoff(now).toISOString()).toBe("2026-07-27T12:00:00.000Z");
  });
});
