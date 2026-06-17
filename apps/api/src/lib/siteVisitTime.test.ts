import { describe, expect, it } from "vitest";
import {
  SiteVisitOverlapError,
  siteVisitRangesOverlap,
  siteVisitTimeRange,
} from "./siteVisitTime.js";

describe("siteVisitTimeRange", () => {
  it("parses date and HH:MM time", () => {
    const { start, end } = siteVisitTimeRange("2026-06-16", "14:30", 60);
    expect(start.getHours()).toBe(14);
    expect(start.getMinutes()).toBe(30);
    expect(end.getTime() - start.getTime()).toBe(60 * 60_000);
  });
});

describe("siteVisitRangesOverlap", () => {
  it("detects overlapping visits on the same day", () => {
    expect(siteVisitRangesOverlap("2026-06-16", "10:00", 60, "2026-06-16", "10:30", 60)).toBe(true);
  });

  it("allows back-to-back visits", () => {
    expect(siteVisitRangesOverlap("2026-06-16", "10:00", 60, "2026-06-16", "11:00", 60)).toBe(
      false,
    );
  });

  it("ignores visits on different days", () => {
    expect(siteVisitRangesOverlap("2026-06-16", "10:00", 60, "2026-06-17", "10:00", 60)).toBe(
      false,
    );
  });
});

describe("SiteVisitOverlapError", () => {
  it("has a user-friendly message", () => {
    expect(new SiteVisitOverlapError().message).toContain("already has a visit");
  });
});
