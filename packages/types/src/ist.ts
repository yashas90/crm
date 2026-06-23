export const IST_TIMEZONE = "Asia/Kolkata";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getIstDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST_TIMEZONE }).format(date);
}

export function getIstHourMinute(date = new Date()): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

/** True during the first `windowMinutes` of the given IST hour (for daily jobs). */
export function isIstDailyWindow(hour: number, windowMinutes = 15, date = new Date()): boolean {
  const { hour: h, minute: m } = getIstHourMinute(date);
  return h === hour && m < windowMinutes;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  return utc.toISOString().slice(0, 10);
}

/** UTC instant for an IST wall-clock date/time (YYYY-MM-DD, hour, minute). */
export function istWallClockToDate(dateKey: string, hour: number, minute: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, hour, minute, 0, 0) - IST_OFFSET_MS);
}

/** UTC bounds for one IST calendar day. offsetDays: 0 = today IST, -1 = yesterday IST. */
export function getIstDayBounds(
  offsetDays = 0,
  reference = new Date(),
): { start: Date; end: Date; dateKey: string } {
  const dateKey = addDaysToDateKey(getIstDateKey(reference), offsetDays);
  const start = istWallClockToDate(dateKey, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end, dateKey };
}

export function isIstMonday(date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    weekday: "long",
  }).format(date);
  return weekday === "Monday";
}

function getIstWeekdayIndex(date = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIMEZONE,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

export function getIstWeekBounds(reference = new Date()): { start: Date; end: Date } {
  const dayIndex = getIstWeekdayIndex(reference);
  const mondayOffset = dayIndex === 0 ? 6 : dayIndex - 1;
  const { start } = getIstDayBounds(-mondayOffset, reference);
  const { end } = getIstDayBounds(0, reference);
  return { start, end };
}

export function getIstMonthBounds(reference = new Date()): { start: Date; end: Date } {
  const dateKey = getIstDateKey(reference);
  const start = istWallClockToDate(`${dateKey.slice(0, 7)}-01`, 0, 0);
  const { end } = getIstDayBounds(0, reference);
  return { start, end };
}

export function todayRangeIst(reference = new Date()): { dateFrom: string; dateTo: string } {
  const { start, end } = getIstDayBounds(0, reference);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

export function followUpAtIstDaysFromNow(
  days: number,
  hour = 9,
  minute = 0,
  reference = new Date(),
): string {
  const dateKey = addDaysToDateKey(getIstDateKey(reference), days);
  return istWallClockToDate(dateKey, hour, minute).toISOString();
}

export function isSameIstCalendarDay(a: Date | string, b: Date | string): boolean {
  return getIstDateKey(new Date(a)) === getIstDateKey(new Date(b));
}

export function isBeforeIstDayStart(value: Date | string, reference = new Date()): boolean {
  const { start } = getIstDayBounds(0, reference);
  return new Date(value).getTime() < start.getTime();
}

export function isFollowUpDueTodayIst(
  nextFollowupAt: string | null | undefined,
  reference = new Date(),
): boolean {
  if (!nextFollowupAt) return false;
  return isSameIstCalendarDay(nextFollowupAt, reference);
}

export function formatDateTimeIst(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  empty = "—",
): string {
  if (!value) return empty;
  return new Date(value).toLocaleString("en-IN", { ...options, timeZone: IST_TIMEZONE });
}

export function toDatetimeLocalIst(value: string | null | undefined): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Parse datetime-local value as IST wall clock and return UTC ISO string. */
export function parseDatetimeLocalAsIst(value: string): string {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return istWallClockToDate(dateKey, hour ?? 0, minute ?? 0).toISOString();
}

export function parseVisitStartIst(visitDate: string, visitTime: string): Date {
  const [hours, minutes] = visitTime.split(":").map(Number);
  return istWallClockToDate(visitDate, hours ?? 0, minutes ?? 0);
}

export function formatVisitTimeIst(visitTime: string): string {
  const [h, m] = visitTime.split(":").map(Number);
  const date = istWallClockToDate(getIstDateKey(), h ?? 0, m ?? 0);
  return date.toLocaleTimeString("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}
