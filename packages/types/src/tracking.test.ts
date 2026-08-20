import { describe, expect, it } from "vitest";
import { isWithinTrackingHours, trackingScheduleLabel } from "./tracking.js";

describe("isWithinTrackingHours", () => {
  it("allows mid-day IST on a weekday", () => {
    // 2026-08-20 12:00 IST = 06:30 UTC
    expect(isWithinTrackingHours(new Date("2026-08-20T06:30:00.000Z"))).toBe(true);
  });

  it("allows Sunday within window", () => {
    // 2026-08-16 was Sunday; 10:00 IST = 04:30 UTC
    expect(isWithinTrackingHours(new Date("2026-08-16T04:30:00.000Z"))).toBe(true);
  });

  it("rejects before 9:30 AM IST", () => {
    // 09:00 IST = 03:30 UTC
    expect(isWithinTrackingHours(new Date("2026-08-20T03:30:00.000Z"))).toBe(false);
  });

  it("allows at 9:30 AM IST", () => {
    // 09:30 IST = 04:00 UTC
    expect(isWithinTrackingHours(new Date("2026-08-20T04:00:00.000Z"))).toBe(true);
  });

  it("rejects at/after 8:30 PM IST", () => {
    // 20:30 IST = 15:00 UTC
    expect(isWithinTrackingHours(new Date("2026-08-20T15:00:00.000Z"))).toBe(false);
  });

  it("formats schedule label", () => {
    expect(trackingScheduleLabel()).toContain("09:30");
    expect(trackingScheduleLabel()).toContain("20:30");
  });
});
