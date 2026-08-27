import { describe, expect, it } from "vitest";
import {
  TRACKING_DEFAULTS,
  deriveAgentAvailabilityStatus,
  deriveTrackingHealthStatus,
  isLastKnownLocation,
  isLikelyUninstalled,
  isWithinTrackingHours,
  minutesDuringTrackingHours,
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

describe("minutesDuringTrackingHours", () => {
  it("excludes the overnight 20:30–09:30 gap", () => {
    // 20:28 IST 20 Aug → 09:45 IST 21 Aug = 2 min remaining + 15 min next morning
    const lastPing = new Date("2026-08-20T14:58:00.000Z");
    const nextMorning = new Date("2026-08-21T04:15:00.000Z");
    expect(minutesDuringTrackingHours(lastPing, nextMorning)).toBe(17);
  });

  it("counts only active-hour minutes during the day", () => {
    const from = new Date("2026-08-20T04:00:00.000Z"); // 09:30 IST
    const to = new Date("2026-08-20T04:45:00.000Z"); // 10:15 IST
    expect(minutesDuringTrackingHours(from, to)).toBe(45);
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
    missingAlertMinutes: 45,
    possibleUninstallMinutes: 1440,
    now: new Date("2026-08-20T06:10:00.000Z"),
  };

  it("returns ACTIVE when communicating", () => {
    expect(deriveTrackingHealthStatus(base)).toBe("ACTIVE");
  });

  it("stays ACTIVE after 45+ min without GPS (phone off / no internet / force-stop)", () => {
    expect(
      deriveTrackingHealthStatus({
        ...base,
        withinHours: true,
        lastSeenAt: new Date("2026-08-20T04:00:00.000Z"),
        lastLocationAt: new Date("2026-08-20T04:00:00.000Z"),
        lastHeartbeatAt: new Date("2026-08-20T04:00:00.000Z"),
        now: new Date("2026-08-20T06:00:00.000Z"),
      }),
    ).toBe("ACTIVE");
  });

  it("stays ACTIVE when heartbeat is recent but GPS is old", () => {
    expect(
      deriveTrackingHealthStatus({
        ...base,
        withinHours: true,
        lastSeenAt: new Date("2026-08-20T06:05:00.000Z"),
        lastHeartbeatAt: new Date("2026-08-20T06:05:00.000Z"),
        lastLocationAt: new Date("2026-08-20T05:00:00.000Z"),
        now: new Date("2026-08-20T06:10:00.000Z"),
      }),
    ).toBe("ACTIVE");
  });

  it("returns STALE only after 24h silence with no boot or queued pings", () => {
    expect(
      deriveTrackingHealthStatus({
        ...base,
        lastSeenAt: new Date("2026-08-19T04:00:00.000Z"),
        lastLocationAt: new Date("2026-08-19T04:00:00.000Z"),
        lastHeartbeatAt: new Date("2026-08-19T04:00:00.000Z"),
        now: new Date("2026-08-20T06:00:00.000Z"),
      }),
    ).toBe("STALE");
  });

  it("does not mark STALE when a boot happened after the last ping", () => {
    expect(
      deriveTrackingHealthStatus({
        ...base,
        lastSeenAt: new Date("2026-08-19T04:00:00.000Z"),
        lastLocationAt: new Date("2026-08-19T04:00:00.000Z"),
        lastHeartbeatAt: new Date("2026-08-19T04:00:00.000Z"),
        lastBootAt: new Date("2026-08-20T05:50:00.000Z"),
        now: new Date("2026-08-20T06:00:00.000Z"),
      }),
    ).toBe("ACTIVE");
  });

  it("does not mark STALE when offline pings are queued", () => {
    expect(
      deriveTrackingHealthStatus({
        ...base,
        lastSeenAt: new Date("2026-08-19T04:00:00.000Z"),
        lastLocationAt: new Date("2026-08-19T04:00:00.000Z"),
        lastHeartbeatAt: new Date("2026-08-19T04:00:00.000Z"),
        hasQueuedOfflinePings: true,
        now: new Date("2026-08-20T06:00:00.000Z"),
      }),
    ).toBe("ACTIVE");
  });

  it("returns LOCATION_PERMISSION_DENIED", () => {
    expect(
      deriveTrackingHealthStatus({
        ...base,
        locationPermissionStatus: "denied",
      }),
    ).toBe("LOCATION_PERMISSION_DENIED");
  });

  it("returns PAUSED overnight instead of STALE", () => {
    expect(
      deriveTrackingHealthStatus({
        ...base,
        withinHours: false,
        lastSeenAt: new Date("2026-08-19T15:00:00.000Z"),
        lastLocationAt: new Date("2026-08-19T15:00:00.000Z"),
        lastHeartbeatAt: new Date("2026-08-19T15:00:00.000Z"),
        now: new Date("2026-08-20T01:00:00.000Z"),
      }),
    ).toBe("PAUSED");
  });
});

describe("deriveAgentAvailabilityStatus", () => {
  it("stays active after 45+ min without GPS during hours", () => {
    expect(
      deriveAgentAvailabilityStatus({
        trackingPolicyEnabled: true,
        trackingEnabledGlobal: true,
        clientTrackingEnabled: true,
        lastLocationAt: new Date("2026-08-20T05:00:00.000Z"),
        lastSeenAt: new Date("2026-08-20T05:00:00.000Z"),
        missingAlertMinutes: 45,
        possibleUninstallMinutes: 1440,
        withinHours: true,
        now: new Date("2026-08-20T06:00:00.000Z"),
      }),
    ).toBe("active");
  });

  it("marks paused outside tracking hours", () => {
    expect(
      deriveAgentAvailabilityStatus({
        trackingPolicyEnabled: true,
        trackingEnabledGlobal: true,
        clientTrackingEnabled: true,
        lastLocationAt: new Date("2026-08-20T14:58:00.000Z"),
        missingAlertMinutes: 45,
        withinHours: false,
        now: new Date("2026-08-20T16:00:00.000Z"),
      }),
    ).toBe("paused");
  });

  it("marks stale only when likely uninstalled", () => {
    expect(
      deriveAgentAvailabilityStatus({
        trackingPolicyEnabled: true,
        trackingEnabledGlobal: true,
        clientTrackingEnabled: true,
        lastLocationAt: new Date("2026-08-19T04:00:00.000Z"),
        lastSeenAt: new Date("2026-08-19T04:00:00.000Z"),
        missingAlertMinutes: 45,
        possibleUninstallMinutes: 1440,
        withinHours: true,
        now: new Date("2026-08-20T06:00:00.000Z"),
      }),
    ).toBe("stale");
  });

  it("marks offline when tracking disabled", () => {
    expect(
      deriveAgentAvailabilityStatus({
        trackingPolicyEnabled: false,
        trackingEnabledGlobal: true,
        clientTrackingEnabled: true,
        lastLocationAt: new Date("2026-08-20T06:00:00.000Z"),
        missingAlertMinutes: 45,
        now: new Date("2026-08-20T06:10:00.000Z"),
      }),
    ).toBe("offline");
  });
});

describe("isLastKnownLocation / isLikelyUninstalled", () => {
  it("treats overnight silence as last-known while outside hours, not uninstalled", () => {
    const lastPing = new Date("2026-08-20T14:58:00.000Z"); // 20:28 IST
    const night = new Date("2026-08-20T20:00:00.000Z"); // 01:30 IST
    expect(
      isLastKnownLocation({
        lastLocationAt: lastPing,
        missingAlertMinutes: 45,
        now: night,
      }),
    ).toBe(true);
    expect(
      isLikelyUninstalled({
        lastSeenAt: lastPing,
        lastLocationAt: lastPing,
        lastHeartbeatAt: lastPing,
        possibleUninstallMinutes: TRACKING_DEFAULTS.possibleUninstallMinutes,
        missingAlertMinutes: 45,
        now: night,
      }),
    ).toBe(false);
  });

  it("does not treat the first 45 tracking-hours minutes after 09:30 as last-known", () => {
    const lastPing = new Date("2026-08-20T14:58:00.000Z");
    const morning = new Date("2026-08-21T04:15:00.000Z"); // 09:45 IST
    expect(
      isLastKnownLocation({
        lastLocationAt: lastPing,
        missingAlertMinutes: 45,
        now: morning,
      }),
    ).toBe(false);
    expect(
      isLikelyUninstalled({
        lastSeenAt: lastPing,
        lastLocationAt: lastPing,
        lastHeartbeatAt: lastPing,
        possibleUninstallMinutes: TRACKING_DEFAULTS.possibleUninstallMinutes,
        missingAlertMinutes: 45,
        now: morning,
      }),
    ).toBe(false);
  });
});
