import {
  TRACKING_DEFAULTS,
  type TrackingSchedule,
  isWithinTrackingHours,
  trackingScheduleLabel,
} from "@propninja/types/tracking";
import { env } from "./env.js";

function parseHm(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map((part) => Number(part));
  return { hour: h ?? TRACKING_DEFAULTS.startHour, minute: m ?? TRACKING_DEFAULTS.startMinute };
}

export function getTrackingSchedule(): TrackingSchedule {
  const start = parseHm(env.TRACKING_START_TIME);
  const end = parseHm(env.TRACKING_END_TIME);
  return {
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
  };
}

export function getTrackingConfig() {
  const schedule = getTrackingSchedule();
  return {
    timezone: env.TRACKING_TIMEZONE || TRACKING_DEFAULTS.timezone,
    startTime: env.TRACKING_START_TIME,
    endTime: env.TRACKING_END_TIME,
    intervalMinutes: env.TRACKING_INTERVAL_MINUTES,
    retentionDays: env.TRACKING_RETENTION_DAYS,
    missingAlertMinutes: env.TRACKING_MISSING_ALERT_MINUTES,
    scheduleLabel: trackingScheduleLabel(schedule),
    schedule,
  };
}

export function isTrackingCaptureAllowed(capturedAt: Date = new Date()): boolean {
  return isWithinTrackingHours(capturedAt, getTrackingSchedule());
}
