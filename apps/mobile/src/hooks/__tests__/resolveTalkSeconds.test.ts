import { resolveTalkSeconds } from "@/hooks/useAutoDialerCallLog";

describe("resolveTalkSeconds", () => {
  it("returns 0 for non-answered outcomes", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 120, durationIsTalkOnly: false },
        outcome: "no_answer",
        ringSeconds: 10,
        talkOverride: 90,
      }),
    ).toBe(0);
  });

  it("prefers modal talk override", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 180, durationIsTalkOnly: false },
        outcome: "answered",
        ringSeconds: 30,
        talkOverride: 95,
      }),
    ).toBe(95);
  });

  it("uses native talk duration without subtracting ring", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 60, durationIsTalkOnly: true },
        outcome: "answered",
        ringSeconds: 20,
      }),
    ).toBe(60);
  });

  it("subtracts ring from wall-clock elapsed when no override", () => {
    expect(
      resolveTalkSeconds({
        pending: { durationSeconds: 100, durationIsTalkOnly: false },
        outcome: "answered",
        ringSeconds: 25,
      }),
    ).toBe(75);
  });
});
