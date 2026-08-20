import { getIstHourMinute } from "./ist.js";

/** Shared agent-tracking schedule (Asia/Kolkata). Overridable via env on the API. */
export const TRACKING_DEFAULTS = {
  timezone: "Asia/Kolkata",
  startHour: 9,
  startMinute: 30,
  endHour: 20,
  endMinute: 30,
  intervalMinutes: 30,
  retentionDays: 14,
  missingAlertMinutes: 75,
} as const;

export type TrackingSchedule = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/**
 * True when `now` falls inside Mon–Sun working hours in Asia/Kolkata
 * (default 09:30–20:30 inclusive of start, exclusive of end).
 */
export function isWithinTrackingHours(
  now: Date = new Date(),
  schedule: TrackingSchedule = TRACKING_DEFAULTS,
): boolean {
  const { hour, minute } = getIstHourMinute(now);
  const current = minutesOfDay(hour, minute);
  const start = minutesOfDay(schedule.startHour, schedule.startMinute);
  const end = minutesOfDay(schedule.endHour, schedule.endMinute);
  return current >= start && current < end;
}

export function trackingScheduleLabel(schedule: TrackingSchedule = TRACKING_DEFAULTS): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(schedule.startHour)}:${pad(schedule.startMinute)}–${pad(schedule.endHour)}:${pad(schedule.endMinute)} IST (Mon–Sun)`;
}
