import { describe, expect, it } from "vitest";
import {
  bucketsAreExclusive,
  decideCallOutcome,
  pipelineStageToLeadStatus,
} from "./outcomeRules.js";

describe("decideCallOutcome", () => {
  it("removes not interested contacts and does not create a lead", () => {
    const plan = decideCallOutcome("not_interested", 1);
    expect(plan.softDelete).toBe(true);
    expect(plan.deletedReason).toBe("not_interested");
    expect(plan.createLead).toBe(false);
    expect(plan.poolStatus).toBe("called");
    expect(plan.poolCallOutcome).toBe("not_interested");
    expect(plan.keepVisible).toBe(false);
    expect(bucketsAreExclusive(plan.bucketsAfter)).toBe(true);
    expect(plan.bucketsAfter).toEqual({ inCallingData: false, isLead: false });
  });

  it("creates a lead and removes the calling row when interested", () => {
    const plan = decideCallOutcome("interested", 0);
    expect(plan.createLead).toBe(true);
    expect(plan.softDelete).toBe(true);
    expect(plan.deletedReason).toBe("converted_to_lead");
    expect(plan.poolStatus).toBe("interested");
    expect(plan.bucketsAfter).toEqual({ inCallingData: false, isLead: true });
    expect(bucketsAreExclusive(plan.bucketsAfter)).toBe(true);
  });

  it("keeps attempt 1 and 2 as retry", () => {
    const first = decideCallOutcome("no_answer", 0);
    const second = decideCallOutcome("busy", 1);
    expect(first.softDelete).toBe(false);
    expect(first.callingStatus).toBe("retry");
    expect(first.nextAttempts).toBe(1);
    expect(second.softDelete).toBe(false);
    expect(second.nextAttempts).toBe(2);
    expect(second.bucketsAfter.inCallingData).toBe(true);
    expect(second.bucketsAfter.isLead).toBe(false);
  });

  it("removes the contact on the third unanswered attempt", () => {
    const plan = decideCallOutcome("no_answer", 2);
    expect(plan.softDelete).toBe(true);
    expect(plan.deletedReason).toBe("max_attempts_reached");
    expect(plan.nextAttempts).toBe(3);
    expect(plan.poolStatus).toBe("called");
    expect(plan.poolCallOutcome).toBe("no_answer");
    expect(plan.message).toMatch(/3 attempts/);
    expect(plan.bucketsAfter.inCallingData).toBe(false);
  });

  it("flags invalid numbers on the pool and hides them", () => {
    const plan = decideCallOutcome("invalid", 0);
    expect(plan.poolStatus).toBe("invalid");
    expect(plan.deletedReason).toBe("invalid_number");
    expect(plan.softDelete).toBe(true);
    expect(plan.createLead).toBe(false);
  });

  it("flags DNC on the pool and hides the row", () => {
    const plan = decideCallOutcome("dnc", 2);
    expect(plan.poolStatus).toBe("dnc");
    expect(plan.deletedReason).toBe("dnc");
    expect(plan.keepVisible).toBe(false);
    expect(plan.bucketsAfter.isLead).toBe(false);
  });

  it("keeps callback rows visible", () => {
    const plan = decideCallOutcome("callback", 1);
    expect(plan.softDelete).toBe(false);
    expect(plan.callingStatus).toBe("callback");
    expect(plan.deletedReason).toBeNull();
    expect(plan.poolStatus).toBe("callback");
    expect(plan.keepVisible).toBe(true);
    expect(plan.bucketsAfter).toEqual({ inCallingData: true, isLead: false });
  });

  it("never leaves a contact in both buckets", () => {
    const outcomes = [
      "interested",
      "not_interested",
      "callback",
      "no_answer",
      "busy",
      "invalid",
      "dnc",
    ] as const;
    for (const outcome of outcomes) {
      for (const attempts of [0, 1, 2]) {
        const plan = decideCallOutcome(outcome, attempts);
        expect(bucketsAreExclusive(plan.bucketsAfter)).toBe(true);
        if (plan.createLead) expect(plan.softDelete).toBe(true);
      }
    }
  });
});

describe("pipelineStageToLeadStatus", () => {
  it("maps spec stages onto the existing lead status values", () => {
    expect(pipelineStageToLeadStatus("new")).toBe("new");
    expect(pipelineStageToLeadStatus("contacted")).toBe("contacted");
    expect(pipelineStageToLeadStatus("site_visit_scheduled")).toBe("qualified");
    expect(pipelineStageToLeadStatus("site_visit_done")).toBe("qualified");
    expect(pipelineStageToLeadStatus("negotiation")).toBe("negotiation");
    expect(pipelineStageToLeadStatus("closed_won")).toBe("won");
    expect(pipelineStageToLeadStatus("closed_lost")).toBe("lost");
  });
});
