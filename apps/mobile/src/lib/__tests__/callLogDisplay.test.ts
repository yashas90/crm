import { displayCallOutcome, formatCallLogDuration } from "@/lib/callLogDisplay";

describe("formatCallLogDuration", () => {
  it("shows seconds for sub-minute calls instead of rounding to 0m", () => {
    expect(formatCallLogDuration(0)).toBe("0s");
    expect(formatCallLogDuration(12)).toBe("12s");
    expect(formatCallLogDuration(59)).toBe("59s");
  });

  it("shows minutes for longer calls", () => {
    expect(formatCallLogDuration(60)).toBe("1m");
    expect(formatCallLogDuration(90)).toBe("1m 30s");
    expect(formatCallLogDuration(3600)).toBe("1h");
  });
});

describe("displayCallOutcome", () => {
  it("does not show Answered when talk time is 0", () => {
    expect(displayCallOutcome("answered", 0)).toBe("no_answer");
  });

  it("keeps Answered when talk time is positive", () => {
    expect(displayCallOutcome("answered", 12)).toBe("answered");
  });

  it("leaves other outcomes unchanged", () => {
    expect(displayCallOutcome("busy", 0)).toBe("busy");
    expect(displayCallOutcome(null, 0)).toBeNull();
  });
});
