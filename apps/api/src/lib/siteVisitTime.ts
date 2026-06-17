export type SiteVisitStatus = "scheduled" | "completed" | "cancelled" | "no_show";

/** Normalize visit time to HH:MM:SS for parsing. */
export function normalizeVisitTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  throw new Error("Invalid visit time format");
}

/** Build start/end Date objects for overlap checks (local server timezone). */
export function siteVisitTimeRange(
  visitDate: string,
  visitTime: string,
  durationMinutes: number,
): { start: Date; end: Date } {
  const time = normalizeVisitTime(visitTime);
  const start = new Date(`${visitDate}T${time}`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid visit date/time");
  }
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

export function siteVisitRangesOverlap(
  aDate: string,
  aTime: string,
  aDuration: number,
  bDate: string,
  bTime: string,
  bDuration: number,
): boolean {
  if (aDate !== bDate) return false;
  const a = siteVisitTimeRange(aDate, aTime, aDuration);
  const b = siteVisitTimeRange(bDate, bTime, bDuration);
  return a.start < b.end && b.start < a.end;
}

export class SiteVisitOverlapError extends Error {
  constructor() {
    super("This agent already has a visit scheduled at that time.");
    this.name = "SiteVisitOverlapError";
  }
}

export function formatVisitTimeDisplay(visitTime: string): string {
  const normalized = normalizeVisitTime(visitTime);
  const [hours, minutes] = normalized.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
