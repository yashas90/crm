import {
  CALL_DATE_FILTERS,
  CALL_OUTCOME_FILTERS,
  type CallDateFilter,
  dateRangeForFilter,
  weekRange,
} from "@/lib/callLogFilters";

describe("CALL_DATE_FILTERS", () => {
  it("contains today, week, month", () => {
    const ids = CALL_DATE_FILTERS.map((f) => f.id);
    expect(ids).toContain("today");
    expect(ids).toContain("week");
    expect(ids).toContain("month");
  });
});

describe("CALL_OUTCOME_FILTERS", () => {
  it("contains all and answered", () => {
    const ids = CALL_OUTCOME_FILTERS.map((f) => f.id);
    expect(ids).toContain("all");
    expect(ids).toContain("answered");
    expect(ids).toContain("no_answer");
  });
});

describe("dateRangeForFilter", () => {
  function isValidIso(value: string) {
    return !Number.isNaN(Date.parse(value));
  }

  it("returns valid ISO strings for today", () => {
    const { dateFrom, dateTo } = dateRangeForFilter("today");
    expect(isValidIso(dateFrom)).toBe(true);
    expect(isValidIso(dateTo)).toBe(true);
    expect(new Date(dateFrom) <= new Date(dateTo)).toBe(true);
  });

  it("returns valid ISO strings for week", () => {
    const { dateFrom, dateTo } = dateRangeForFilter("week");
    expect(isValidIso(dateFrom)).toBe(true);
    expect(isValidIso(dateTo)).toBe(true);
    expect(new Date(dateFrom) <= new Date(dateTo)).toBe(true);
  });

  it("returns valid ISO strings for month", () => {
    const { dateFrom, dateTo } = dateRangeForFilter("month");
    expect(isValidIso(dateFrom)).toBe(true);
    expect(isValidIso(dateTo)).toBe(true);
    expect(new Date(dateFrom) <= new Date(dateTo)).toBe(true);
  });

  it("week range is a positive span", () => {
    const { dateFrom, dateTo } = dateRangeForFilter("week");
    expect(new Date(dateTo).getTime()).toBeGreaterThan(new Date(dateFrom).getTime());
  });

  it("month range is a positive span", () => {
    const { dateFrom, dateTo } = dateRangeForFilter("month");
    expect(new Date(dateTo).getTime()).toBeGreaterThan(new Date(dateFrom).getTime());
  });

  it("all filter types return ranges", () => {
    const filters: CallDateFilter[] = ["today", "week", "month"];
    for (const f of filters) {
      const range = dateRangeForFilter(f);
      expect(range.dateFrom).toBeTruthy();
      expect(range.dateTo).toBeTruthy();
    }
  });
});

describe("weekRange", () => {
  it("is equivalent to dateRangeForFilter week", () => {
    const direct = dateRangeForFilter("week");
    const via = weekRange();
    // Both should be in the same day window (allow 1s drift)
    expect(Math.abs(Date.parse(direct.dateFrom) - Date.parse(via.dateFrom))).toBeLessThan(1000);
  });
});
