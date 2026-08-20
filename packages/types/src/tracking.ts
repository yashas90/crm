import { getIstDayOfWeek, getIstHourMinute } from "./ist.js";

/** Shared agent-tracking schedule (Asia/Kolkata). Overridable via env / admin settings. */
export const TRACKING_DEFAULTS = {
  timezone: "Asia/Kolkata",
  startHour: 9,
  startMinute: 30,
  endHour: 20,
  endMinute: 30,
  intervalMinutes: 30,
  retentionDays: 14,
  missingAlertMinutes: 75,
  heartbeatThresholdMinutes: 60,
  /** After this many minutes with no heartbeat+location, prefer POSSIBLE_APP_UNINSTALLED. */
  possibleUninstallMinutes: 180,
  /** 0=Sun … 6=Sat — default every day. */
  activeDays: [0, 1, 2, 3, 4, 5, 6] as number[],
  enabled: true,
} as const;

export type TrackingSchedule = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  /** Days of week (0=Sun … 6=Sat). Defaults to all days. */
  activeDays?: number[];
};

export const TRACKING_HEALTH_STATUSES = [
  "ACTIVE",
  "OFFLINE",
  "LOCATION_PERMISSION_DENIED",
  "LOCATION_PERMISSION_REVOKED",
  "CALL_LOG_PERMISSION_DENIED",
  "CALL_LOG_UNAVAILABLE",
  "APP_NOT_COMMUNICATING",
  "POSSIBLE_APP_UNINSTALLED",
  "DEVICE_CHANGED",
  "TRACKING_DISABLED",
  "OUTSIDE_HOURS",
  "UNKNOWN",
] as const;

export type TrackingHealthStatus = (typeof TRACKING_HEALTH_STATUSES)[number];

export const TRACKING_ALERT_TYPES = [
  "LOCATION_PERMISSION_REVOKED",
  "BACKGROUND_LOCATION_UNAVAILABLE",
  "CALL_LOG_PERMISSION_REVOKED",
  "DEVICE_OFFLINE",
  "TRACKING_STOPPED",
  "MISSING_LOCATION",
  "POSSIBLE_APP_REMOVAL",
  "DEVICE_CHANGED",
  "APP_VERSION_OUTDATED",
  "SYNC_FAILURE",
  "CLEANUP_JOB_FAILURE",
] as const;

export type TrackingAlertType = (typeof TRACKING_ALERT_TYPES)[number];

export const TRACKING_ALERT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type TrackingAlertSeverity = (typeof TRACKING_ALERT_SEVERITIES)[number];

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/**
 * True when `now` falls inside configured working hours in Asia/Kolkata
 * (default 09:30–20:30 inclusive of start, exclusive of end) on an active day.
 */
export function isWithinTrackingHours(
  now: Date = new Date(),
  schedule: TrackingSchedule = TRACKING_DEFAULTS,
): boolean {
  const activeDays = schedule.activeDays ?? TRACKING_DEFAULTS.activeDays;
  const dow = getIstDayOfWeek(now);
  if (!activeDays.includes(dow)) return false;

  const { hour, minute } = getIstHourMinute(now);
  const current = minutesOfDay(hour, minute);
  const start = minutesOfDay(schedule.startHour, schedule.startMinute);
  const end = minutesOfDay(schedule.endHour, schedule.endMinute);
  return current >= start && current < end;
}

export function trackingScheduleLabel(schedule: TrackingSchedule = TRACKING_DEFAULTS): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = schedule.activeDays ?? TRACKING_DEFAULTS.activeDays;
  const dayLabel =
    days.length === 7
      ? "Mon–Sun"
      : days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(",");
  return `${pad(schedule.startHour)}:${pad(schedule.startMinute)}–${pad(schedule.endHour)}:${pad(schedule.endMinute)} IST (${dayLabel})`;
}

export type DeviceHealthInput = {
  trackingPolicyEnabled: boolean;
  trackingEnabledGlobal: boolean;
  clientTrackingEnabled: boolean | null;
  locationPermissionStatus: string | null;
  callLogPermissionStatus: string | null;
  lastSeenAt: Date | null;
  lastLocationAt: Date | null;
  lastHeartbeatAt: Date | null;
  isCurrentDevice: boolean;
  withinHours: boolean;
  heartbeatThresholdMinutes: number;
  missingAlertMinutes: number;
  possibleUninstallMinutes: number;
  now?: Date;
};

/**
 * Derive a conservative health status. Never claims APP_UNINSTALLED with certainty.
 */
export function deriveTrackingHealthStatus(input: DeviceHealthInput): TrackingHealthStatus {
  const now = input.now ?? new Date();

  if (!input.trackingEnabledGlobal || !input.trackingPolicyEnabled) {
    return "TRACKING_DISABLED";
  }
  if (input.clientTrackingEnabled === false) {
    return "TRACKING_DISABLED";
  }

  const locPerm = (input.locationPermissionStatus ?? "").toLowerCase();
  if (locPerm.includes("revok")) return "LOCATION_PERMISSION_REVOKED";
  if (locPerm === "denied" || locPerm === "restricted") return "LOCATION_PERMISSION_DENIED";

  const callPerm = (input.callLogPermissionStatus ?? "").toUpperCase();
  if (callPerm === "DENIED") return "CALL_LOG_PERMISSION_DENIED";
  // UNAVAILABLE is informational; do not override ACTIVE/OFFLINE.

  if (!input.isCurrentDevice) return "DEVICE_CHANGED";

  const lastComm = latestDate([input.lastHeartbeatAt, input.lastSeenAt, input.lastLocationAt]);
  const minutesSinceComm = lastComm
    ? Math.floor((now.getTime() - lastComm.getTime()) / 60_000)
    : Number.POSITIVE_INFINITY;

  if (minutesSinceComm >= input.possibleUninstallMinutes) {
    return "POSSIBLE_APP_UNINSTALLED";
  }
  if (minutesSinceComm >= input.heartbeatThresholdMinutes) {
    return minutesSinceComm >= input.missingAlertMinutes ? "APP_NOT_COMMUNICATING" : "OFFLINE";
  }

  if (!input.withinHours) return "OUTSIDE_HOURS";

  const minutesSinceLoc = input.lastLocationAt
    ? Math.floor((now.getTime() - input.lastLocationAt.getTime()) / 60_000)
    : Number.POSITIVE_INFINITY;
  if (minutesSinceLoc >= input.missingAlertMinutes) {
    return "APP_NOT_COMMUNICATING";
  }

  if (callPerm === "UNAVAILABLE") {
    // Still actively tracking location.
    return "ACTIVE";
  }

  return "ACTIVE";
}

function latestDate(dates: Array<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best;
}

export function alertSeverityForStatus(status: TrackingHealthStatus): TrackingAlertSeverity {
  switch (status) {
    case "POSSIBLE_APP_UNINSTALLED":
    case "LOCATION_PERMISSION_REVOKED":
    case "LOCATION_PERMISSION_DENIED":
      return "CRITICAL";
    case "APP_NOT_COMMUNICATING":
    case "OFFLINE":
    case "CALL_LOG_PERMISSION_DENIED":
    case "TRACKING_DISABLED":
    case "DEVICE_CHANGED":
      return "WARNING";
    default:
      return "INFO";
  }
}
