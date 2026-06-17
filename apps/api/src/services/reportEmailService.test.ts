import { beforeEach, describe, expect, it, vi } from "vitest";
import { summaryToMetricRows } from "./reportEmailService.js";

describe("reportEmailService aggregation", () => {
  it("builds metric rows with percent change vs previous period", () => {
    const rows = summaryToMetricRows(
      {
        date: "2025-06-15",
        newLeads: 10,
        totalCallsMade: 50,
        callsAnswered: 30,
        siteVisitsToday: 4,
        overdueFollowUps: 6,
        coldLeads: 12,
        leadsWon: 2,
      },
      {
        date: "2025-06-14",
        newLeads: 5,
        totalCallsMade: 40,
        callsAnswered: 20,
        siteVisitsToday: 2,
        overdueFollowUps: 8,
        coldLeads: 10,
        leadsWon: 1,
      },
    );

    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ label: "New leads", value: 10, changePercent: 100 });
    expect(rows[1]).toMatchObject({ label: "Calls made", value: 50, changePercent: 25 });
    expect(rows[3]).toMatchObject({ label: "Site visits", value: 4, changePercent: 100 });
    expect(rows[4]).toMatchObject({ label: "Overdue follow-ups", value: 6, changePercent: -25 });
  });

  it("returns null change when previous value is zero and current is zero", () => {
    const rows = summaryToMetricRows(
      {
        date: "2025-06-15",
        newLeads: 0,
        totalCallsMade: 0,
        callsAnswered: 0,
        siteVisitsToday: 0,
        overdueFollowUps: 0,
        coldLeads: 0,
        leadsWon: 0,
      },
      {
        date: "2025-06-14",
        newLeads: 0,
        totalCallsMade: 0,
        callsAnswered: 0,
        siteVisitsToday: 0,
        overdueFollowUps: 0,
        coldLeads: 0,
        leadsWon: 0,
      },
    );

    expect(rows[0]?.changePercent).toBeNull();
  });
});

describe("reportEmailAggregators.pctChange", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("computes percentage change", async () => {
    const { reportEmailAggregators } = await import("./reportEmailService.js");
    expect(reportEmailAggregators.pctChange(15, 10)).toBe(50);
    expect(reportEmailAggregators.pctChange(0, 0)).toBeNull();
    expect(reportEmailAggregators.pctChange(3, 0)).toBe(100);
  });
});
