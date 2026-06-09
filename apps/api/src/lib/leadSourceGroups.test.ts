import { describe, expect, it } from "vitest";
import {
  buildLeadsOverTimeReport,
  buildSourceGroupReport,
  classifySourceGroup,
  formatSourceName,
} from "./leadSourceGroups.js";

describe("leadSourceGroups", () => {
  it("classifies known sources into buckets", () => {
    expect(classifySourceGroup("facebook")).toBe("Social");
    expect(classifySourceGroup("99acres")).toBe("Portals");
    expect(classifySourceGroup("website")).toBe("Others");
    expect(classifySourceGroup(null)).toBe("Others");
  });

  it("formats display names", () => {
    expect(formatSourceName("google-ads")).toBe("Google Ads");
    expect(formatSourceName("walk-in")).toBe("Walk In");
  });

  it("builds leads over time by source group", () => {
    const rows = buildLeadsOverTimeReport([
      { date: "2025-06-01", source: "facebook", count: 2 },
      { date: "2025-06-01", source: "website", count: 3 },
      { date: "2025-06-02", source: "99acres", count: 1 },
    ]);

    expect(rows).toContainEqual({ date: "2025-06-01", count: 2, sourceGroup: "Social" });
    expect(rows).toContainEqual({ date: "2025-06-01", count: 3, sourceGroup: "Others" });
    expect(rows).toContainEqual({ date: "2025-06-02", count: 1, sourceGroup: "Portals" });
  });

  it("builds grouped report with sorted counts", () => {
    const report = buildSourceGroupReport([
      { source: "facebook", count: 3 },
      { source: "instagram", count: 5 },
      { source: "website", count: 2 },
      { source: "99acres", count: 1 },
      { source: null, count: 4 },
    ]);

    expect(report).toHaveLength(3);
    expect(report[0]?.sourceGroup).toBe("Social");
    expect(report[0]?.sources[0]).toEqual({ name: "Facebook Ads", count: 0 });
    expect(report[0]?.sources[1]).toEqual({ name: "Google Ads", count: 0 });
    expect(report[0]?.sources[2]).toEqual({ name: "Instagram", count: 5 });
    expect(report[2]?.sources.find((s) => s.name === "Unknown")).toEqual({
      name: "Unknown",
      count: 4,
    });
  });

  it("pins ad source bars with counts ahead of other social sources", () => {
    const report = buildSourceGroupReport([
      { source: "Facebook Ads", count: 7 },
      { source: "Google Ads", count: 2 },
      { source: "instagram", count: 5 },
    ]);

    const social = report.find((group) => group.sourceGroup === "Social");
    expect(social?.sources.slice(0, 3)).toEqual([
      { name: "Facebook Ads", count: 7 },
      { name: "Google Ads", count: 2 },
      { name: "Instagram", count: 5 },
    ]);
  });
});
