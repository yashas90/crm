import { classifyNativeTalk, outcomeFromTalkSeconds } from "@/lib/callOutcomeFromTalk";

describe("outcomeFromTalkSeconds", () => {
  it("maps positive talk time to answered", () => {
    expect(outcomeFromTalkSeconds(1)).toBe("answered");
    expect(outcomeFromTalkSeconds(42)).toBe("answered");
  });

  it("maps zero talk time to no_answer", () => {
    expect(outcomeFromTalkSeconds(0)).toBe("no_answer");
  });
});

describe("classifyNativeTalk", () => {
  it("treats a missing OS row as no_answer, not ring time", () => {
    expect(classifyNativeTalk(null)).toEqual({
      durationSeconds: 0,
      durationIsTalkOnly: false,
      outcome: "no_answer",
    });
  });

  it("treats OS talk duration 0 as no_answer", () => {
    expect(classifyNativeTalk(0)).toEqual({
      durationSeconds: 0,
      durationIsTalkOnly: true,
      outcome: "no_answer",
    });
  });

  it("treats positive OS talk duration as answered", () => {
    expect(classifyNativeTalk(12)).toEqual({
      durationSeconds: 12,
      durationIsTalkOnly: true,
      outcome: "answered",
    });
  });
});
