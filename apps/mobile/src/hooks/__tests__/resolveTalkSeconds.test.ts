import { defaultOutcomeFromDuration, resolveTalkSeconds } from "@/hooks/useAutoDialerCallLog";

describe("resolveTalkSeconds", () => {
  it("returns 0 for non-answered outcomes", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 40, durationIsTalkOnly: true },
        outcome: "no_answer",
      }),
    ).toBe(0);
  });

  it("uses native talk-only duration when answered", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 42, durationIsTalkOnly: true },
        outcome: "answered",
      }),
    ).toBe(42);
  });

  it("subtracts ring from wall-clock fallback", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 60, durationIsTalkOnly: false },
        outcome: "answered",
        ringSeconds: 15,
      }),
    ).toBe(45);
  });

  it("prefers talkOverride when provided", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 60, durationIsTalkOnly: true },
        outcome: "answered",
        talkOverride: 12,
      }),
    ).toBe(12);
  });
});

describe("defaultOutcomeFromDuration", () => {
  it("maps positive duration to answered", () => {
    expect(defaultOutcomeFromDuration(42)).toBe("answered");
  });

  it("maps zero duration to no_answer (not connected)", () => {
    expect(defaultOutcomeFromDuration(0)).toBe("no_answer");
  });
});
