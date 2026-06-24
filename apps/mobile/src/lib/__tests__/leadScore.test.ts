import {
  HOT_LEAD_SCORE_THRESHOLD,
  WARM_LEAD_SCORE_THRESHOLD,
  scoreBadgeStyle,
  scoreTier,
} from "@/lib/leadScore";

describe("scoreTier", () => {
  it("returns hot for scores >= threshold", () => {
    expect(scoreTier(HOT_LEAD_SCORE_THRESHOLD)).toBe("hot");
    expect(scoreTier(100)).toBe("hot");
    expect(scoreTier(70)).toBe("hot");
  });

  it("returns warm for scores between thresholds", () => {
    expect(scoreTier(WARM_LEAD_SCORE_THRESHOLD)).toBe("warm");
    expect(scoreTier(69)).toBe("warm");
    expect(scoreTier(40)).toBe("warm");
  });

  it("returns cold for scores below warm threshold", () => {
    expect(scoreTier(39)).toBe("cold");
    expect(scoreTier(0)).toBe("cold");
  });
});

describe("scoreBadgeStyle", () => {
  it("returns green style for hot score", () => {
    const style = scoreBadgeStyle(80);
    expect(style.label).toBe("Hot");
    expect(style.text).toBe("#047857");
  });

  it("returns orange style for warm score", () => {
    const style = scoreBadgeStyle(50);
    expect(style.label).toBe("Warm");
    expect(style.text).toBe("#C2410C");
  });

  it("returns grey style for cold score", () => {
    const style = scoreBadgeStyle(20);
    expect(style.label).toBe("Cold");
    expect(style.text).toBe("#64748B");
  });
});
