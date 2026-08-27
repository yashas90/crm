import { describe, expect, it } from "vitest";
import { normalizeLoggedCall } from "./callOutcomes.js";

describe("normalizeLoggedCall", () => {
  it("keeps answered when talk time is positive", () => {
    expect(normalizeLoggedCall({ outcome: "answered", durationSeconds: 42 })).toEqual({
      outcome: "answered",
      durationSeconds: 42,
      status: "completed",
      disposition: "answered",
    });
  });

  it("coerces answered with zero talk time to no_answer", () => {
    expect(normalizeLoggedCall({ outcome: "answered", durationSeconds: 0 })).toEqual({
      outcome: "no_answer",
      durationSeconds: 0,
      status: "missed",
      disposition: "no_answer",
    });
  });

  it("does not change busy or voicemail", () => {
    expect(normalizeLoggedCall({ outcome: "busy", durationSeconds: 0 }).outcome).toBe("busy");
    expect(normalizeLoggedCall({ outcome: "left_voicemail", durationSeconds: 8 }).outcome).toBe(
      "left_voicemail",
    );
  });
});
