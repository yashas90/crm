import {
  MIN_CALL_LOG_ELAPSED_MS,
  calculateCallDurationMinutes,
  shouldOpenCallLogSheet,
} from "@/lib/callDuration";

describe("calculateCallDurationMinutes", () => {
  it("returns 0 when callStartTime is null or undefined", () => {
    expect(calculateCallDurationMinutes(null)).toBe(0);
    expect(calculateCallDurationMinutes(undefined)).toBe(0);
  });

  it("returns 0 when end is before start", () => {
    expect(calculateCallDurationMinutes(10_000, 5_000)).toBe(0);
  });

  it("rounds elapsed time to whole minutes", () => {
    const start = 0;
    expect(calculateCallDurationMinutes(start, 30_000)).toBe(1);
    expect(calculateCallDurationMinutes(start, 90_000)).toBe(2);
    expect(calculateCallDurationMinutes(start, 29_000)).toBe(0);
  });

  it("uses Date.now() when end time is omitted", () => {
    const start = Date.now() - 120_000;
    expect(calculateCallDurationMinutes(start)).toBe(2);
  });
});

describe("shouldOpenCallLogSheet", () => {
  it("returns false when start is missing", () => {
    expect(shouldOpenCallLogSheet(null)).toBe(false);
  });

  it("returns false when elapsed is under 5 seconds", () => {
    const start = 1_000;
    expect(shouldOpenCallLogSheet(start, start + MIN_CALL_LOG_ELAPSED_MS - 1)).toBe(false);
  });

  it("returns true when elapsed is at least 5 seconds", () => {
    const start = 1_000;
    expect(shouldOpenCallLogSheet(start, start + MIN_CALL_LOG_ELAPSED_MS)).toBe(true);
    expect(shouldOpenCallLogSheet(start, start + 120_000)).toBe(true);
  });
});
