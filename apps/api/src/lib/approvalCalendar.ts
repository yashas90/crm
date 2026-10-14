import { addDaysToDateKey, getIstDateKey } from "@propninja/types/ist";
import { type QuarterRef, quarterFromDate, quarterKey } from "./quarters.js";

export function monthKeyFromDateKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(now = new Date()) {
  return shiftMonthKey(monthKeyFromDateKey(getIstDateKey(now)), -1);
}

export function quarterForMonth(monthKey: string): QuarterRef {
  const found = quarterFromDate(`${monthKey}-01`);
  if (!found) {
    throw new Error(`Invalid month ${monthKey}`);
  }
  return found;
}

export function monthsInQuarter(quarter: QuarterRef) {
  const start =
    quarter.code === "JFM" ? 1 : quarter.code === "AMJ" ? 4 : quarter.code === "JAS" ? 7 : 10;
  return [0, 1, 2].map((offset) => {
    const month = start + offset;
    return `${quarter.year}-${String(month).padStart(2, "0")}`;
  });
}

export function isMonthStart(dateKey: string) {
  return dateKey.endsWith("-01");
}

export function isMonthEnd(dateKey: string) {
  return monthKeyFromDateKey(addDaysToDateKey(dateKey, 1)) !== monthKeyFromDateKey(dateKey);
}

const QUARTER_ENDS = new Set(["03-31", "06-30", "09-30", "12-31"]);

export function isQuarterEnd(dateKey: string) {
  return QUARTER_ENDS.has(dateKey.slice(5));
}

/** 1st of the month after `from` in Asia/Kolkata. */
export function firstOfNextMonth(from = new Date()) {
  const next = shiftMonthKey(monthKeyFromDateKey(getIstDateKey(from)), 1);
  return `${next}-01`;
}

export function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatEffectiveDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function quarterName(quarter: QuarterRef) {
  return quarter.name;
}

export function quarterStorageKey(quarter: QuarterRef) {
  return quarterKey(quarter);
}
