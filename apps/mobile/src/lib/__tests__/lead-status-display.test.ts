import { getLeadStatusDisplay } from "../lead-status-display";

describe("getLeadStatusDisplay", () => {
  const now = new Date("2026-07-30T12:00:00.000Z");

  it("shows fresh new as New", () => {
    expect(
      getLeadStatusDisplay({ leadStatus: "new", createdAt: "2026-07-30T10:00:00.000Z" }, now)
        .primary,
    ).toBe("New");
  });

  it("shows stale new as Pending", () => {
    expect(
      getLeadStatusDisplay({ leadStatus: "new", createdAt: "2026-07-28T10:00:00.000Z" }, now)
        .primary,
    ).toBe("Pending");
  });

  it("shows contacted without follow-up as Pending", () => {
    expect(getLeadStatusDisplay({ leadStatus: "contacted" }, now).primary).toBe("Pending");
  });

  it("shows contacted with future follow-up as Callback", () => {
    expect(
      getLeadStatusDisplay(
        {
          leadStatus: "contacted",
          nextFollowupAt: "2026-07-30T15:00:00.000Z",
        },
        now,
      ).primary,
    ).toBe("Callback");
  });

  it("shows past follow-up as Overdue", () => {
    expect(
      getLeadStatusDisplay(
        {
          leadStatus: "contacted",
          nextFollowupAt: "2026-07-30T10:00:00.000Z",
        },
        now,
      ).primary,
    ).toBe("Overdue");
  });
});
