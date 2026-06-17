export const IST_TIMEZONE = "Asia/Kolkata";

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

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  return utc.toISOString().slice(0, 10);
}

/** UTC bounds for one IST calendar day. offsetDays: 0 = today IST, -1 = yesterday IST. */
export function getIstDayBounds(
  offsetDays = 0,
  reference = new Date(),
): { start: Date; end: Date; dateKey: string } {
  const dateKey = addDaysToDateKey(getIstDateKey(reference), offsetDays);
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0) - IST_OFFSET_MS);
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
