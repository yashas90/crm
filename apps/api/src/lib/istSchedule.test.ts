import { describe, expect, it } from "vitest";
import { getIstDayBounds, isIstMonday } from "./istSchedule.js";

describe("istSchedule report windows", () => {
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
});
