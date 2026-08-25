import { MOBILE_LEAD_STAGES, defaultMobileLeadsStage, stageToLeadQuery } from "../leads-stage";

describe("leads-stage", () => {
  it("defaults to pending", () => {
    expect(defaultMobileLeadsStage()).toBe("pending");
  });

  it("exposes pending, new, overdue, follow_up, hot", () => {
    expect(MOBILE_LEAD_STAGES.map((s) => s.id)).toEqual([
      "pending",
      "new",
      "overdue",
      "follow_up",
      "hot",
    ]);
  });

  it("maps pending to contacted status", () => {
    expect(stageToLeadQuery("pending")).toEqual({ status: "contacted" });
  });

  it("maps new to new status", () => {
    expect(stageToLeadQuery("new")).toEqual({ status: "new" });
  });

  it("maps hot to hot temperature", () => {
    expect(stageToLeadQuery("hot")).toEqual({ temperature: "hot" });
  });

  it("maps overdue / follow_up to follow-up date windows", () => {
    const overdue = stageToLeadQuery("overdue");
    expect(overdue.activeOnly).toBe("true");
    expect(overdue.orderByFollowUp).toBe("true");
    expect(overdue.followUpDueBefore).toBeTruthy();
    expect(overdue.followUpDueAfter).toBeUndefined();

    const followUp = stageToLeadQuery("follow_up");
    expect(followUp.activeOnly).toBe("true");
    expect(followUp.orderByFollowUp).toBe("true");
    expect(followUp.followUpDueAfter).toBeTruthy();
    expect(followUp.followUpDueBefore).toBeUndefined();
  });
});
