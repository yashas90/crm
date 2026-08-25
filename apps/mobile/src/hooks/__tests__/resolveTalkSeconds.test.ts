import { defaultOutcomeFromDuration, resolveTalkSeconds } from "@/hooks/useAutoDialerCallLog";

describe("resolveTalkSeconds", () => {
  it("returns 0 for non-answered outcomes", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 90, durationIsTalkOnly: true },
        outcome: "no_answer",
      }),
    ).toBe(0);
  });

  it("uses talkOverride when provided for answered calls", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 90, durationIsTalkOnly: true },
        outcome: "answered",
        talkOverride: 45,
      }),
    ).toBe(45);
  });

  it("uses native talk-only duration when available", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 70, durationIsTalkOnly: true },
        outcome: "answered",
        ringSeconds: 20,
      }),
    ).toBe(70);
  });

  it("subtracts ring from wall-clock elapsed when not talk-only", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 90, durationIsTalkOnly: false },
        outcome: "answered",
        ringSeconds: 15,
      }),
    ).toBe(75);
  });
});

describe("defaultOutcomeFromDuration", () => {
  it("counts positive duration as answered when agent skips call update", () => {
    expect(defaultOutcomeFromDuration(42)).toBe("answered");
  });

  it("counts zero duration as no_answer when agent skips call update", () => {
    expect(defaultOutcomeFromDuration(0)).toBe("no_answer");
  });
});
