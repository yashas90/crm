import { describe, expect, it } from "vitest";
import {
  deriveTrackingHealthStatus,
  isWithinTrackingHours,
  trackingScheduleLabel,
} from "./tracking.js";

describe("isWithinTrackingHours", () => {
  it("allows weekday mid-day IST", () => {
    expect(isWithinTrackingHours(new Date("2026-08-20T06:30:00.000Z"))).toBe(true);
  });

  it("allows Sunday within window", () => {
    expect(isWithinTrackingHours(new Date("2026-08-16T04:30:00.000Z"))).toBe(true);
  });

  it("rejects before 9:30 AM IST", () => {
    expect(isWithinTrackingHours(new Date("2026-08-20T03:30:00.000Z"))).toBe(false);
  });

  it("allows at 9:30 AM IST", () => {
    expect(isWithinTrackingHours(new Date("2026-08-20T04:00:00.000Z"))).toBe(true);
  });

  it("rejects at/after 8:30 PM IST", () => {
    expect(isWithinTrackingHours(new Date("2026-08-20T15:00:00.000Z"))).toBe(false);
  });

  it("formats schedule label", () => {
    expect(trackingScheduleLabel()).toContain("09:30");
    expect(trackingScheduleLabel()).toContain("20:30");
  });

  it("respects activeDays exclusion", () => {
    // Sunday
    expect(
      isWithinTrackingHours(new Date("2026-08-16T04:30:00.000Z"), {
        startHour: 9,
        startMinute: 30,
        endHour: 20,
        endMinute: 30,
        activeDays: [1, 2, 3, 4, 5],
      }),
    ).toBe(false);
  });
});

describe("deriveTrackingHealthStatus", () => {
  const base = {
    trackingPolicyEnabled: true,
    trackingEnabledGlobal: true,
    clientTrackingEnabled: true,
    locationPermissionStatus: "granted",
    callLogPermissionStatus: "granted",
    lastSeenAt: new Date("2026-08-20T06:00:00.000Z"),
    lastLocationAt: new Date("2026-08-20T06:00:00.000Z"),
    lastHeartbeatAt: new Date("2026-08-20T06:01:00.000Z"),
    isCurrentDevice: true,
    withinHours: true,
    heartbeatThresholdMinutes: 60,
    missingAlertMinutes: 75,
    possibleUninstallMinutes: 180,
    now: new Date("2026-08-20T06:10:00.000Z"),
  };

  it("returns ACTIVE when communicating", () => {
    expect(deriveTrackingHealthStatus(base)).toBe("ACTIVE");
  });

  it("returns POSSIBLE_APP_UNINSTALLED after long silence", () => {
    expect(
      deriveTrackingHealthStatus({
        ...base,
        lastSeenAt: new Date("2026-08-20T01:00:00.000Z"),
        lastLocationAt: new Date("2026-08-20T01:00:00.000Z"),
        lastHeartbeatAt: new Date("2026-08-20T01:00:00.000Z"),
        now: new Date("2026-08-20T06:00:00.000Z"),
      }),
    ).toBe("POSSIBLE_APP_UNINSTALLED");
  });

  it("returns LOCATION_PERMISSION_DENIED", () => {
    expect(
      deriveTrackingHealthStatus({
        ...base,
        locationPermissionStatus: "denied",
      }),
    ).toBe("LOCATION_PERMISSION_DENIED");
  });
});
