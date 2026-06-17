import { describe, expect, it, vi } from "vitest";

const recalculateAllActiveLeadScores = vi.fn();

vi.mock("../services/leadScoringService.js", () => ({
  recalculateAllActiveLeadScores,
}));

describe("syncLeadScores", () => {
  it("recalculates scores for active leads", async () => {
    recalculateAllActiveLeadScores.mockResolvedValue({
      updated: 12,
      checked: 12,
      skipped: false,
    });

    const { syncLeadScores } = await import("./leadScoringJob.js");
    const result = await syncLeadScores(new Date("2026-06-16T12:00:00Z"));

    expect(recalculateAllActiveLeadScores).toHaveBeenCalled();
    expect(result.updated).toBe(12);
  });
});
