import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEAD_SCORING_RULES,
  HOT_LEAD_SCORE_THRESHOLD,
  type LeadScoringInput,
  calculateLeadScore,
  clampLeadScore,
  scoreTier,
} from "./leadScoring.js";

const now = new Date("2026-06-16T12:00:00Z");

function baseInput(overrides: Partial<LeadScoringInput> = {}): LeadScoringInput {
  return {
    now,
    createdAt: "2026-06-15T12:00:00Z",
    lastContactedAt: "2026-06-15T18:00:00Z",
    leadSource: "Website",
    whatsappRepliedAt: null,
    hasAnsweredCall: false,
    hasScheduledVisit: false,
    hasCompletedVisit: false,
    hasRecentNote: false,
    isReEnquired: false,
    doNotCall: false,
    consecutiveNoAnswers: 0,
    ...overrides,
  };
}

describe("calculateLeadScore", () => {
  it("starts at zero with no signals", () => {
    const result = calculateLeadScore(
      baseInput({
        createdAt: "2026-06-01T12:00:00Z",
        lastContactedAt: "2026-06-14T12:00:00Z",
        leadSource: null,
      }),
    );
    expect(result.score).toBe(0);
    expect(result.factors).toHaveLength(0);
  });

  it("adds points for answered call", () => {
    const result = calculateLeadScore(baseInput({ hasAnsweredCall: true }));
    expect(result.factors).toContainEqual({
      label: "Called and answered",
      points: DEFAULT_LEAD_SCORING_RULES.answeredCall,
    });
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it("adds points for WhatsApp reply", () => {
    const result = calculateLeadScore(baseInput({ whatsappRepliedAt: "2026-06-16T10:00:00Z" }));
    expect(result.factors).toContainEqual({
      label: "Replied to WhatsApp",
      points: 15,
    });
  });

  it("adds points for scheduled site visit", () => {
    const result = calculateLeadScore(baseInput({ hasScheduledVisit: true }));
    expect(result.factors).toContainEqual({
      label: "Site visit scheduled",
      points: 10,
    });
  });

  it("adds points for completed site visit", () => {
    const result = calculateLeadScore(baseInput({ hasCompletedVisit: true }));
    expect(result.factors).toContainEqual({
      label: "Site visit completed",
      points: 20,
    });
  });

  it("adds points for recent note", () => {
    const result = calculateLeadScore(baseInput({ hasRecentNote: true }));
    expect(result.factors).toContainEqual({
      label: "Note added in last 3 days",
      points: 5,
    });
  });

  it("adds points for re-enquiry", () => {
    const result = calculateLeadScore(baseInput({ isReEnquired: true }));
    expect(result.factors).toContainEqual({
      label: "Re-enquired",
      points: 10,
    });
  });

  it("adds freshness points for leads created in last 24 hours", () => {
    const result = calculateLeadScore(
      baseInput({ createdAt: "2026-06-16T08:00:00Z", lastContactedAt: "2026-06-16T08:00:00Z" }),
    );
    expect(result.factors).toContainEqual({
      label: "Lead created in last 24 hours",
      points: 15,
    });
  });

  it("adds freshness points for leads created 1–3 days ago", () => {
    const result = calculateLeadScore(
      baseInput({ createdAt: "2026-06-14T12:00:00Z", lastContactedAt: "2026-06-14T12:00:00Z" }),
    );
    expect(result.factors).toContainEqual({
      label: "Lead created 1–3 days ago",
      points: 10,
    });
  });

  it("adds freshness points for leads created 4–7 days ago", () => {
    const result = calculateLeadScore(
      baseInput({ createdAt: "2026-06-10T12:00:00Z", lastContactedAt: "2026-06-10T12:00:00Z" }),
    );
    expect(result.factors).toContainEqual({
      label: "Lead created 4–7 days ago",
      points: 5,
    });
  });

  it("applies no-contact penalty at 5+ days", () => {
    const result = calculateLeadScore(
      baseInput({
        createdAt: "2026-06-01T12:00:00Z",
        lastContactedAt: "2026-06-10T12:00:00Z",
      }),
    );
    expect(result.factors).toContainEqual({
      label: "No contact in 5+ days",
      points: -10,
    });
  });

  it("applies stronger no-contact penalty at 10+ days", () => {
    const result = calculateLeadScore(
      baseInput({
        createdAt: "2026-05-01T12:00:00Z",
        lastContactedAt: "2026-06-01T12:00:00Z",
      }),
    );
    expect(result.factors).toContainEqual({
      label: "No contact in 10+ days",
      points: -20,
    });
    expect(result.factors.some((f) => f.label === "No contact in 5+ days")).toBe(false);
  });

  it("subtracts for Do Not Call", () => {
    const result = calculateLeadScore(baseInput({ doNotCall: true }));
    expect(result.factors).toContainEqual({
      label: "Marked Do Not Call",
      points: -15,
    });
  });

  it("subtracts for 3+ consecutive no answers", () => {
    const result = calculateLeadScore(baseInput({ consecutiveNoAnswers: 3 }));
    expect(result.factors).toContainEqual({
      label: "No answer 3+ times in a row",
      points: -10,
    });
  });

  it("adds paid ads source bonus", () => {
    const result = calculateLeadScore(baseInput({ leadSource: "Meta Ads" }));
    expect(result.factors).toContainEqual({
      label: "Source: Meta Ads",
      points: 10,
    });
  });

  it("adds referral source bonus", () => {
    const result = calculateLeadScore(baseInput({ leadSource: "Referral" }));
    expect(result.factors).toContainEqual({
      label: "Source: Referral",
      points: 5,
    });
  });

  it("clamps score to 0–100", () => {
    const high = calculateLeadScore(
      baseInput({
        createdAt: "2026-06-16T08:00:00Z",
        lastContactedAt: "2026-06-16T08:00:00Z",
        leadSource: "Meta Ads",
        hasAnsweredCall: true,
        whatsappRepliedAt: "2026-06-16T09:00:00Z",
        hasScheduledVisit: true,
        hasCompletedVisit: true,
        hasRecentNote: true,
        isReEnquired: true,
      }),
    );
    expect(high.score).toBe(100);

    const low = calculateLeadScore(
      baseInput({
        createdAt: "2026-05-01T12:00:00Z",
        lastContactedAt: "2026-05-01T12:00:00Z",
        doNotCall: true,
        consecutiveNoAnswers: 4,
      }),
    );
    expect(low.score).toBe(0);
  });
});

describe("scoreTier", () => {
  it("classifies hot, warm, and cold", () => {
    expect(scoreTier(HOT_LEAD_SCORE_THRESHOLD)).toBe("hot");
    expect(scoreTier(69)).toBe("warm");
    expect(scoreTier(39)).toBe("cold");
  });
});

describe("clampLeadScore", () => {
  it("rounds and clamps", () => {
    expect(clampLeadScore(150)).toBe(100);
    expect(clampLeadScore(-5)).toBe(0);
    expect(clampLeadScore(42.6)).toBe(43);
  });
});
