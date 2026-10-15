import { describe, expect, it } from "vitest";
import {
  dailyNeeded,
  daysRemainingInIstMonth,
  greetingForIstClock,
  isIncentiveUnlocked,
  quoteForIstDate,
  resolveMonthlyTarget,
} from "./morningBriefMath.js";

describe("morning brief greeting", () => {
  it("uses the IST hour boundaries", () => {
    expect(greetingForIstClock(4, 59)).toBe("Welcome back");
    expect(greetingForIstClock(5, 0)).toBe("Good morning");
    expect(greetingForIstClock(11, 59)).toBe("Good morning");
    expect(greetingForIstClock(12, 0)).toBe("Good afternoon");
    expect(greetingForIstClock(16, 59)).toBe("Good afternoon");
    expect(greetingForIstClock(17, 0)).toBe("Good evening");
    expect(greetingForIstClock(20, 29)).toBe("Good evening");
    expect(greetingForIstClock(20, 30)).toBe("Welcome back");
    expect(greetingForIstClock(23, 15)).toBe("Welcome back");
  });
});

describe("morning brief daily needed", () => {
  it("splits the gap across days left, including today", () => {
    expect(daysRemainingInIstMonth(new Date("2026-10-15T04:30:00.000Z"))).toBe(17);
    expect(daysRemainingInIstMonth(new Date("2026-10-31T06:30:00.000Z"))).toBe(1);
    expect(dailyNeeded(1_000_000, 400_000, 6)).toBe(100_000);
    expect(dailyNeeded(100_000, 150_000, 5)).toBe(0);
    expect(dailyNeeded(90_000, 30_000, 1)).toBe(60_000);
  });
});

describe("morning brief incentive lock", () => {
  it("unlocks only when collected NR is above the eligibility target", () => {
    expect(isIncentiveUnlocked(500_000, 500_000)).toBe(false);
    expect(isIncentiveUnlocked(500_001, 500_000)).toBe(true);
    expect(isIncentiveUnlocked(0, 100_000)).toBe(false);
    expect(isIncentiveUnlocked(10, 0)).toBe(false);
  });

  it("prefers monthly basic times the band multiplier over a stored revenue target", () => {
    const resolved = resolveMonthlyTarget({
      monthlyBasic: 50_000,
      band: "NE",
      storedRevenueTarget: 999_999,
    });
    expect(resolved).toEqual({ amount: 250_000, source: "incentive", band: "NE" });
    expect(isIncentiveUnlocked(250_000, resolved.amount)).toBe(false);
    expect(isIncentiveUnlocked(250_001, resolved.amount)).toBe(true);
  });

  it("uses the stored revenue target only when there is no incentive band", () => {
    expect(
      resolveMonthlyTarget({
        monthlyBasic: 40_000,
        band: null,
        storedRevenueTarget: 180_000,
      }),
    ).toEqual({ amount: 180_000, source: "agent_target", band: null });
  });
});

describe("quote of the day", () => {
  it("stays the same for one IST day", () => {
    const morning = quoteForIstDate(new Date("2026-10-15T04:30:00.000Z"));
    const evening = quoteForIstDate(new Date("2026-10-15T14:30:00.000Z"));
    expect(morning).toEqual(evening);
    expect(morning.text.length).toBeGreaterThan(10);
  });
});
