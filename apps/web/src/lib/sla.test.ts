import { describe, expect, it } from "vitest";
import { computeLeadSlaState, daysSince, lastEngagementAt } from "./sla";

describe("sla helpers", () => {
  it("uses last activity, then last contacted, then created", () => {
    const created = "2026-01-01T00:00:00.000Z";
    const contacted = "2026-02-01T00:00:00.000Z";
    const activity = "2026-03-01T00:00:00.000Z";

    expect(lastEngagementAt({ createdAt: created })).toBe(created);
    expect(lastEngagementAt({ createdAt: created, lastContactedAt: contacted })).toBe(contacted);
    expect(
      lastEngagementAt({
        createdAt: created,
        lastContactedAt: contacted,
        lastActivityAt: activity,
      }),
    ).toBe(activity);
  });

  it("marks active pipeline leads as breached after threshold", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000).toISOString();
    const state = computeLeadSlaState({
      leadStatus: "contacted",
      lastActivityAt: fourDaysAgo,
      createdAt: fourDaysAgo,
    });

    expect(state.applies).toBe(true);
    expect(state.severity).toBe("breach");
    expect(state.daysSinceActivity).toBeGreaterThanOrEqual(4);
  });

  it("does not apply SLA to terminal statuses", () => {
    const state = computeLeadSlaState({
      leadStatus: "won",
      createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    });
    expect(state.applies).toBe(false);
    expect(state.severity).toBe("na");
  });

  it("computes whole days since timestamp", () => {
    const twoDaysAgo = new Date(Date.now() - 2.4 * 86_400_000).toISOString();
    expect(daysSince(twoDaysAgo)).toBe(2);
  });
});
