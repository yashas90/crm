import { getLeadStatusDisplay } from "@/lib/lead-status-display";
import { describe, expect, it } from "vitest";

describe("getLeadStatusDisplay", () => {
  const now = new Date("2026-07-30T12:00:00.000Z");

  it("maps fresh new status", () => {
    const result = getLeadStatusDisplay(
      {
        leadStatus: "new",
        createdAt: "2026-07-30T10:00:00.000Z",
      },
      now,
    );
    expect(result.primary).toBe("New");
    expect(result.secondary).toBeUndefined();
  });

  it("shows stale new (>24h) as Pending", () => {
    const result = getLeadStatusDisplay(
      {
        leadStatus: "new",
        createdAt: "2026-07-28T10:00:00.000Z",
      },
      now,
    );
    expect(result.primary).toBe("Pending");
    expect(result.secondary).toBeUndefined();
  });

  it("keeps New even when Meta auto follow-up is past due", () => {
    const result = getLeadStatusDisplay(
      {
        leadStatus: "new",
        createdAt: "2026-07-30T10:00:00.000Z",
        nextFollowupAt: "2026-07-30T10:30:00.000Z",
      },
      now,
    );
    expect(result.primary).toBe("New");
  });

  it("keeps Pending for stale new even with past follow-up", () => {
    const result = getLeadStatusDisplay(
      {
        leadStatus: "new",
        createdAt: "2026-07-28T10:00:00.000Z",
        nextFollowupAt: "2026-07-29T10:00:00.000Z",
      },
      now,
    );
    expect(result.primary).toBe("Pending");
  });

  it("shows contacted without follow-up as Pending only", () => {
    const result = getLeadStatusDisplay(
      {
        leadStatus: "contacted",
      },
      now,
    );
    expect(result.primary).toBe("Pending");
    expect(result.secondary).toBeUndefined();
  });

  it("shows scheduled future follow-up as Callback (not dual Pending+Callback)", () => {
    const result = getLeadStatusDisplay(
      {
        leadStatus: "contacted",
        nextFollowupAt: "2026-07-30T15:00:00.000Z",
      },
      now,
    );
    expect(result.primary).toBe("Callback");
    expect(result.secondary).toBeUndefined();
  });

  it("shows past-due follow-up as Overdue after status left New", () => {
    const result = getLeadStatusDisplay(
      {
        leadStatus: "qualified",
        nextFollowupAt: "2026-07-30T10:00:00.000Z",
      },
      now,
    );
    expect(result.primary).toBe("Overdue");
    expect(result.secondary).toBeUndefined();
  });

  it("shows site visit from follow-up type", () => {
    const result = getLeadStatusDisplay(
      {
        leadStatus: "qualified",
        nextFollowupAt: "2026-07-30T15:00:00.000Z",
        customFields: { followup_type: "site_visit" },
      },
      now,
    );
    expect(result.primary).toBe("Site Visit");
  });

  it("shows not interested from tags", () => {
    const result = getLeadStatusDisplay(
      {
        leadStatus: "contacted",
        tags: ["not_interested"],
      },
      now,
    );
    expect(result.primary).toBe("Not Interested");
  });
});
