import { describe, expect, it } from "vitest";
import {
  buildLeadFunnel,
  changePercent,
  rankLeadSources,
  resolveAdminDashboardWindows,
  splitReceivedLeads,
  sumAmountBetween,
} from "./adminDashboardPeriod.js";

const NOON_IST_OCT_15 = new Date("2026-10-15T08:00:00.000Z");

describe("admin dashboard periods", () => {
  it("builds IST windows for 15 Oct 2026", () => {
    const windows = resolveAdminDashboardWindows("quarter", NOON_IST_OCT_15);

    expect(windows.today).toMatchObject({ fromKey: "2026-10-15", toKey: "2026-10-15" });
    expect(windows.yesterday).toMatchObject({ fromKey: "2026-10-14", toKey: "2026-10-14" });
    expect(windows.last7).toMatchObject({ fromKey: "2026-10-09", toKey: "2026-10-15" });
    expect(windows.previous7).toMatchObject({ fromKey: "2026-10-02", toKey: "2026-10-08" });
    expect(windows.last30).toMatchObject({ fromKey: "2026-09-16", toKey: "2026-10-15" });
    expect(windows.thisQuarter).toMatchObject({ fromKey: "2026-10-01", toKey: "2026-10-15" });
    expect(windows.lastQuarter).toMatchObject({ fromKey: "2026-07-01", toKey: "2026-09-30" });
    expect(windows.quarterBeforeLast).toMatchObject({ fromKey: "2026-04-01", toKey: "2026-06-30" });
    expect(windows.selected).toEqual(windows.thisQuarter);
    expect(windows.previous).toEqual(windows.lastQuarter);
    expect(windows.label).toBe("This quarter");
  });

  it("uses the previous calendar quarter when the selected period is this quarter", () => {
    const january = resolveAdminDashboardWindows("quarter", new Date("2026-01-10T08:00:00.000Z"));
    expect(january.thisQuarter.fromKey).toBe("2026-01-01");
    expect(january.lastQuarter).toMatchObject({ fromKey: "2025-10-01", toKey: "2025-12-31" });
  });

  it("compares today with yesterday", () => {
    const windows = resolveAdminDashboardWindows("today", NOON_IST_OCT_15);
    expect(windows.previous.fromKey).toBe("2026-10-14");
    expect(windows.label).toBe("Today");
  });
});

describe("admin dashboard math", () => {
  it("keeps a zero-to-zero change at 0%", () => {
    expect(changePercent(0, 0)).toBe(0);
    expect(changePercent(4, 0)).toBe(100);
    expect(changePercent(15, 10)).toBe(50);
    expect(changePercent(5, 10)).toBe(-50);
  });

  it("sums inclusive date keys", () => {
    const amounts = new Map([
      ["2026-10-14", 100.4],
      ["2026-10-15", 50],
      ["2026-10-16", 999],
    ]);
    expect(sumAmountBetween(amounts, "2026-10-14", "2026-10-15")).toBe(150);
  });

  it("splits active leads from lost, not interested, and dropped", () => {
    const split = splitReceivedLeads([
      { status: "new", count: 3 },
      { status: "contacted", count: 1 },
      { status: "lost", count: 2 },
      { status: "dropped", count: 1 },
      { status: "not_interested", count: 1 },
    ]);
    expect(split.total).toBe(8);
    expect(split.active).toBe(4);
    expect(split.lost).toBe(4);
    expect(split.byStatus[0]).toMatchObject({ status: "new", label: "New", count: 3 });
  });

  it("builds a funnel as a percent of all leads", () => {
    const funnel = buildLeadFunnel({
      leads: 10,
      prospect: 4,
      opportunity: 2,
      booked: 1,
      invoiced: 1,
    });
    expect(funnel.map((stage) => stage.label)).toEqual([
      "Leads",
      "Prospect",
      "Opportunity",
      "Booked",
      "Invoiced",
    ]);
    expect(funnel.map((stage) => stage.percent)).toEqual([100, 40, 20, 10, 10]);
  });

  it("ranks sources and pads the list so an empty source can still show", () => {
    const ranked = rankLeadSources([{ source: "facebook", count: 2 }], (source) =>
      source === "facebook" ? "Meta Ads" : source,
    );
    expect(ranked[0]).toEqual({ source: "Meta Ads", count: 2, percent: 100 });
    expect(ranked).toHaveLength(5);
    expect(ranked.some((row) => row.count === 0)).toBe(true);
  });
});
