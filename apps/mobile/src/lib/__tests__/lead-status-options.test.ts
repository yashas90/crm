import {
  MOBILE_LEAD_STATUS_OPTIONS,
  buildLeadStatusPatch,
  formatLeadStatusLabel,
} from "@/lib/lead-status-options";

describe("formatLeadStatusLabel", () => {
  it("returns friendly label for null", () => {
    expect(formatLeadStatusLabel(null)).toBe("No previous status found");
    expect(formatLeadStatusLabel(undefined)).toBe("No previous status found");
  });

  it("maps known status to option label", () => {
    expect(formatLeadStatusLabel("won")).toBe("Booked");
    expect(formatLeadStatusLabel("contacted")).toBe("Callback");
    expect(formatLeadStatusLabel("qualified")).toBe("Meeting Scheduled");
  });

  it("capitalises unknown statuses", () => {
    expect(formatLeadStatusLabel("new")).toBe("New");
    expect(formatLeadStatusLabel("not_interested")).toBe("Not Interested");
  });
});

describe("MOBILE_LEAD_STATUS_OPTIONS", () => {
  it("has at least 5 options", () => {
    expect(MOBILE_LEAD_STATUS_OPTIONS.length).toBeGreaterThanOrEqual(5);
  });

  it("every option has label and value", () => {
    for (const opt of MOBILE_LEAD_STATUS_OPTIONS) {
      expect(opt.label).toBeTruthy();
      expect(opt.value).toBeTruthy();
    }
  });
});

describe("buildLeadStatusPatch", () => {
  const lead = { assignedUser: { id: "550e8400-e29b-41d4-a716-446655440001" } };
  const otherUser = "550e8400-e29b-41d4-a716-446655440002";

  it("always includes leadStatus", () => {
    const patch = buildLeadStatusPatch({ leadStatus: "contacted" }, lead, { canReassign: false });
    expect(patch.leadStatus).toBe("contacted");
  });

  it("includes assignedTo when manager changes assignee", () => {
    const patch = buildLeadStatusPatch({ leadStatus: "contacted", assignedTo: otherUser }, lead, {
      canReassign: true,
    });
    expect(patch.assignedTo).toBe(otherUser);
  });

  it("skips assignedTo when same as current", () => {
    const patch = buildLeadStatusPatch(
      { leadStatus: "contacted", assignedTo: lead.assignedUser!.id },
      lead,
      { canReassign: true },
    );
    expect(patch.assignedTo).toBeUndefined();
  });

  it("skips assignedTo when canReassign is false", () => {
    const patch = buildLeadStatusPatch({ leadStatus: "contacted", assignedTo: otherUser }, lead, {
      canReassign: false,
    });
    expect(patch.assignedTo).toBeUndefined();
  });

  it("skips assignedTo when not a valid uuid", () => {
    const patch = buildLeadStatusPatch(
      { leadStatus: "contacted", assignedTo: "not-a-uuid" },
      lead,
      { canReassign: true },
    );
    expect(patch.assignedTo).toBeUndefined();
  });

  it("does not send nextFollowupAt (server clears follow-up on terminal status)", () => {
    for (const status of ["won", "lost", "not_interested", "dropped"] as const) {
      const patch = buildLeadStatusPatch({ leadStatus: status }, lead, { canReassign: false });
      expect(patch.nextFollowupAt).toBeUndefined();
    }
  });

  it("only sends leadStatus for active statuses", () => {
    const patch = buildLeadStatusPatch({ leadStatus: "contacted" }, lead, { canReassign: false });
    expect(patch).toEqual({ leadStatus: "contacted" });
  });
});
