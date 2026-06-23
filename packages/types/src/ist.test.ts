import { describe, expect, it } from "vitest";
import {
  followUpAtIstDaysFromNow,
  formatDateTimeIst,
  getIstDateKey,
  getIstDayBounds,
  isFollowUpDueTodayIst,
  isIstMonday,
  isSameIstCalendarDay,
  parseDatetimeLocalAsIst,
  parseVisitStartIst,
  toDatetimeLocalIst,
  todayRangeIst,
} from "./ist.js";

describe("ist scheduling", () => {
  it("computes IST day bounds for yesterday offset", () => {
    const reference = new Date("2025-06-16T03:00:00.000Z");
    const { dateKey, start, end } = getIstDayBounds(-1, reference);
    expect(dateKey).toBe("2025-06-15");
    expect(start.toISOString()).toBe("2025-06-14T18:30:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it("detects Monday in IST", () => {
    const mondayMorningIst = new Date("2025-06-16T03:00:00.000Z");
    expect(isIstMonday(mondayMorningIst)).toBe(true);
    const tuesdayMorningIst = new Date("2025-06-17T03:00:00.000Z");
    expect(isIstMonday(tuesdayMorningIst)).toBe(false);
  });

  it("schedules follow-up at 9 AM IST", () => {
    const reference = new Date("2025-06-16T03:00:00.000Z");
    const tomorrowKey = getIstDateKey(new Date(reference.getTime() + 86_400_000));
    const iso = followUpAtIstDaysFromNow(1, 9, 0, reference);
    expect(iso).toBe(parseVisitStartIst(tomorrowKey, "09:00").toISOString());
  });

  it("round-trips datetime-local as IST", () => {
    const iso = "2025-06-16T03:30:00.000Z";
    const local = toDatetimeLocalIst(iso);
    expect(local).toBe("2025-06-16T09:00");
    expect(parseDatetimeLocalAsIst(local)).toBe(iso);
  });

  it("uses IST calendar day for due today", () => {
    const reference = new Date("2025-06-16T03:00:00.000Z");
    const followUp = "2025-06-16T04:30:00.000Z";
    expect(isFollowUpDueTodayIst(followUp, reference)).toBe(true);
    expect(isSameIstCalendarDay(followUp, reference)).toBe(true);
  });

  it("todayRangeIst matches day bounds", () => {
    const reference = new Date("2025-06-16T03:00:00.000Z");
    const range = todayRangeIst(reference);
    const { start, end } = getIstDayBounds(0, reference);
    expect(range.dateFrom).toBe(start.toISOString());
    expect(range.dateTo).toBe(end.toISOString());
  });

  it("formats timestamps in IST", () => {
    const formatted = formatDateTimeIst("2025-06-16T03:30:00.000Z");
    expect(formatted).toContain("9");
  });
});
