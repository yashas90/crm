import {
  addDaysToDateKey,
  getIstDateKey,
  getIstDayOfWeek,
  getIstHourMinute,
  istWallClockToDate,
} from "./ist.js";

/** Shared agent-tracking schedule (Asia/Kolkata). Overridable via env / admin settings. */
export const TRACKING_DEFAULTS = {
  timezone: "Asia/Kolkata",
  startHour: 9,
  startMinute: 30,
  endHour: 20,
  endMinute: 30,
  intervalMinutes: 30,
  retentionDays: 14,
  /** GPS older than this (counting only 09:30–20:30 IST) is last-known, not STALE. */
  missingAlertMinutes: 45,
  heartbeatThresholdMinutes: 60,
  /** STALE / likely-uninstalled after 24h with no ping, boot, or queued offline pings. */
  possibleUninstallMinutes: 1440,
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
  "STALE",
  "OFFLINE",
  "PAUSED",
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

/** Spec-facing agent availability: active | paused | stale | offline. */
export const AGENT_AVAILABILITY_STATUSES = ["active", "paused", "stale", "offline"] as const;
export type AgentAvailabilityStatus = (typeof AGENT_AVAILABILITY_STATUSES)[number];

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

/**
 * Minutes of expected tracking time between `from` and `to` (exclusive of overnight /
 * weekend gaps). Last ping at 20:28 IST → 09:45 next day counts ~17 minutes, not 13 hours.
 */
export function minutesDuringTrackingHours(
  from: Date,
  to: Date,
  schedule: TrackingSchedule = TRACKING_DEFAULTS,
): number {
  if (to.getTime() <= from.getTime()) return 0;
  const activeDays = schedule.activeDays ?? TRACKING_DEFAULTS.activeDays;
  let total = 0;
  let dateKey = getIstDateKey(from);
  const endKey = getIstDateKey(to);
  let guard = 0;

  while (guard < 400) {
    guard += 1;
    const noon = istWallClockToDate(dateKey, 12, 0);
    const dow = getIstDayOfWeek(noon);
    if (activeDays.includes(dow)) {
      const windowStart = istWallClockToDate(dateKey, schedule.startHour, schedule.startMinute);
      const windowEnd = istWallClockToDate(dateKey, schedule.endHour, schedule.endMinute);
      const overlapStart = Math.max(from.getTime(), windowStart.getTime());
      const overlapEnd = Math.min(to.getTime(), windowEnd.getTime());
      if (overlapEnd > overlapStart) {
        total += Math.floor((overlapEnd - overlapStart) / 60_000);
      }
    }
    if (dateKey === endKey) break;
    dateKey = addDaysToDateKey(dateKey, 1);
  }
  return total;
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
  lastBootAt?: Date | null;
  hasQueuedOfflinePings?: boolean;
  isCurrentDevice: boolean;
  withinHours: boolean;
  heartbeatThresholdMinutes: number;
  missingAlertMinutes: number;
  possibleUninstallMinutes: number;
  schedule?: TrackingSchedule;
  now?: Date;
};

function latestDate(dates: Array<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best;
}

/**
 * STALE is reserved for likely uninstall: 24h+ silence, no boot after last ping,
 * no queued offline pings. Phone-off / no-internet / force-stop / night gap are NOT stale.
 */
export function isLikelyUninstalled(input: {
  lastSeenAt: Date | null;
  lastLocationAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastBootAt?: Date | null;
  hasQueuedOfflinePings?: boolean;
  possibleUninstallMinutes: number;
  missingAlertMinutes: number;
  schedule?: TrackingSchedule;
  now?: Date;
}): boolean {
  if (input.hasQueuedOfflinePings) return false;
  const now = input.now ?? new Date();
  const lastComm = latestDate([input.lastHeartbeatAt, input.lastSeenAt, input.lastLocationAt]);
  if (!lastComm) return true;

  if (input.lastBootAt && input.lastBootAt.getTime() > lastComm.getTime()) {
    return false;
  }

  const wallClockMinutes = Math.floor((now.getTime() - lastComm.getTime()) / 60_000);
  if (wallClockMinutes < input.possibleUninstallMinutes) return false;

  const trackingMinutes = minutesDuringTrackingHours(
    lastComm,
    now,
    input.schedule ?? TRACKING_DEFAULTS,
  );
  return trackingMinutes >= input.missingAlertMinutes;
}

export type AgentAvailabilityInput = {
  trackingPolicyEnabled: boolean;
  trackingEnabledGlobal: boolean;
  clientTrackingEnabled: boolean | null;
  lastLocationAt: Date | null;
  lastSeenAt?: Date | null;
  lastHeartbeatAt?: Date | null;
  lastBootAt?: Date | null;
  hasQueuedOfflinePings?: boolean;
  missingAlertMinutes: number;
  possibleUninstallMinutes?: number;
  schedule?: TrackingSchedule;
  withinHours?: boolean;
  now?: Date;
};

/**
 * Display status: active | paused | stale | offline.
 * STALE only when the app is likely uninstalled (24h+ no ping during active hours,
 * no boot event, no offline queue). Overnight and transient device issues stay Active/Paused.
 */
export function deriveAgentAvailabilityStatus(
  input: AgentAvailabilityInput,
): AgentAvailabilityStatus {
  const now = input.now ?? new Date();
  const schedule = input.schedule ?? TRACKING_DEFAULTS;
  if (
    !input.trackingEnabledGlobal ||
    !input.trackingPolicyEnabled ||
    input.clientTrackingEnabled === false
  ) {
    return "offline";
  }

  const withinHours = input.withinHours ?? isWithinTrackingHours(now, schedule);
  if (!withinHours) return "paused";

  if (
    isLikelyUninstalled({
      lastSeenAt: input.lastSeenAt ?? input.lastLocationAt,
      lastLocationAt: input.lastLocationAt,
      lastHeartbeatAt: input.lastHeartbeatAt ?? null,
      lastBootAt: input.lastBootAt,
      hasQueuedOfflinePings: input.hasQueuedOfflinePings,
      possibleUninstallMinutes:
        input.possibleUninstallMinutes ?? TRACKING_DEFAULTS.possibleUninstallMinutes,
      missingAlertMinutes: input.missingAlertMinutes,
      schedule,
      now,
    })
  ) {
    return "stale";
  }

  return "active";
}

/**
 * True when the map should show last-known coordinates (GPS older than 45 tracking-hours
 * minutes, or currently outside the window). This is independent of STALE.
 */
export function isLastKnownLocation(input: {
  lastLocationAt: Date | null;
  missingAlertMinutes: number;
  schedule?: TrackingSchedule;
  withinHours?: boolean;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const schedule = input.schedule ?? TRACKING_DEFAULTS;
  const withinHours = input.withinHours ?? isWithinTrackingHours(now, schedule);
  if (!input.lastLocationAt) return true;
  if (!withinHours) return true;
  const missed = minutesDuringTrackingHours(input.lastLocationAt, now, schedule);
  return missed >= input.missingAlertMinutes;
}

/**
 * Derive a conservative health status. Never claims APP_UNINSTALLED with certainty.
 * STALE is uninstall-only. Overnight silence is PAUSED (OUTSIDE_HOURS kept as alias).
 */
export function deriveTrackingHealthStatus(input: DeviceHealthInput): TrackingHealthStatus {
  const now = input.now ?? new Date();
  const schedule = input.schedule ?? TRACKING_DEFAULTS;

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

  if (!input.isCurrentDevice) return "DEVICE_CHANGED";

  if (!input.withinHours) return "PAUSED";

  if (
    isLikelyUninstalled({
      lastSeenAt: input.lastSeenAt,
      lastLocationAt: input.lastLocationAt,
      lastHeartbeatAt: input.lastHeartbeatAt,
      lastBootAt: input.lastBootAt,
      hasQueuedOfflinePings: input.hasQueuedOfflinePings,
      possibleUninstallMinutes: input.possibleUninstallMinutes,
      missingAlertMinutes: input.missingAlertMinutes,
      schedule,
      now,
    })
  ) {
    return "STALE";
  }

  return "ACTIVE";
}

export function alertSeverityForStatus(status: TrackingHealthStatus): TrackingAlertSeverity {
  switch (status) {
    case "STALE":
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
