import { describe, expect, it } from "vitest";
import { planReshuffle } from "./reshuffleLeads.js";

const agents = ["zeeshan", "poornesh", "pawan", "karv"];

describe("planReshuffle", () => {
  it("moves every lead off its current agent", () => {
    const plan = planReshuffle(
      [
        { id: "l1", assignedTo: "zeeshan" },
        { id: "l2", assignedTo: "zeeshan" },
        { id: "l3", assignedTo: "poornesh" },
        { id: "l4", assignedTo: "karv" },
      ],
      agents,
    );

    expect(plan.skipped).toEqual([]);
    expect(plan.assignments).toHaveLength(4);
    for (const assignment of plan.assignments) {
      const current = assignment.leadId === "l1" || assignment.leadId === "l2" ? "zeeshan" : null;
      const original =
        assignment.leadId === "l3" ? "poornesh" : assignment.leadId === "l4" ? "karv" : current;
      expect(assignment.userId).not.toBe(original);
      expect(agents).toContain(assignment.userId);
    }
  });

  it("does not pile every lead onto the same next agent", () => {
    const plan = planReshuffle(
      Array.from({ length: 6 }, (_, index) => ({
        id: `l${index}`,
        assignedTo: "zeeshan",
      })),
      agents,
    );

    const recipients = new Set(plan.assignments.map((row) => row.userId));
    expect(recipients.has("zeeshan")).toBe(false);
    expect(recipients.size).toBeGreaterThan(1);
  });

  it("skips a lead when the only selected agent already has it", () => {
    const plan = planReshuffle([{ id: "l1", assignedTo: "zeeshan" }], ["zeeshan"]);
    expect(plan.assignments).toEqual([]);
    expect(plan.skipped).toEqual([
      { id: "l1", message: "No other agent is available for this lead" },
    ]);
  });

  it("can assign an unassigned lead to anyone in the pool", () => {
    const plan = planReshuffle([{ id: "l1", assignedTo: null }], ["poornesh"]);
    expect(plan.assignments).toEqual([{ leadId: "l1", userId: "poornesh" }]);
  });
});
