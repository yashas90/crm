import { describe, expect, it, vi } from "vitest";
import { getIstDateKey, isIstDailyWindow } from "../lib/istSchedule.js";

describe("isIstDailyWindow", () => {
  it("is true during 9am IST window", () => {
    const nineAmIst = new Date("2026-06-16T03:30:00Z");
    expect(isIstDailyWindow(9, 15, nineAmIst)).toBe(true);
    expect(getIstDateKey(nineAmIst)).toMatch(/2026-06-16/);
  });

  it("is false outside 9am IST", () => {
    const noonIst = new Date("2026-06-16T06:30:00Z");
    expect(isIstDailyWindow(9, 15, noonIst)).toBe(false);
  });
});

describe("syncColdLeadAlerts", () => {
  it("skips when outside IST morning window", async () => {
    vi.doMock("../services/leadService.js", () => ({
      leadService: { markColdLeads: vi.fn() },
    }));
    const { syncColdLeadAlerts, resetDailyFollowUpJobState } = await import(
      "../jobs/dailyFollowUpJob.js"
    );
    resetDailyFollowUpJobState();
    const result = await syncColdLeadAlerts(new Date("2026-06-16T06:30:00Z"));
    expect(result).toEqual({ skipped: true, reason: "outside_window" });
  });
});
