import { leadActivities } from "@propninja/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    existingLead: {
      id: "lead-1",
      orgId: "org-1",
      assignedTo: null as string | null,
      leadStatus: "new",
      phone: "+911111111111",
      deletedAt: null,
    },
    updatedLead: null as Record<string, unknown> | null,
    assignmentCalls: [] as unknown[],
    activityInserts: [] as unknown[],
  };

  const tx = {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => [state.updatedLead],
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (row: unknown) => {
        if (table === leadActivities) {
          state.activityInserts.push(row);
        }
        return Promise.resolve();
      },
    }),
  };

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [state.existingLead],
        }),
      }),
    }),
    transaction: async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx),
  };

  return { state, db, tx };
});

vi.mock("../lib/db.js", () => ({
  db: mocks.db,
}));

vi.mock("./leadAssignmentService.js", () => ({
  recordLeadAssignment: vi.fn(async (_tx, input) => {
    mocks.state.assignmentCalls.push(input);
    return { id: "assignment-1", ...input };
  }),
}));

vi.mock("./leadScoringService.js", () => ({
  recalculateLeadScore: vi.fn(),
  getLeadScoreBreakdown: vi.fn(),
}));

describe("leadService assignment audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.existingLead.assignedTo = null;
    mocks.state.updatedLead = {
      id: "lead-1",
      assignedTo: "agent-2",
      leadStatus: "new",
    };
    mocks.state.assignmentCalls = [];
    mocks.state.activityInserts = [];
  });

  it("inserts a lead_assignments row when PATCH changes assignedTo", async () => {
    const { leadService } = await import("./leadService.js");
    const { recordLeadAssignment } = await import("./leadAssignmentService.js");

    const result = await leadService.updateLead({
      leadId: "lead-1",
      actingUserId: "manager-1",
      payload: {
        assignedTo: "agent-2",
        reason: "Workload balancing",
      },
    });

    expect(result).toMatchObject({ assignedTo: "agent-2" });
    expect(recordLeadAssignment).toHaveBeenCalledOnce();
    expect(mocks.state.assignmentCalls[0]).toMatchObject({
      leadId: "lead-1",
      fromAgentId: null,
      toAgentId: "agent-2",
      assignedBy: "manager-1",
      reason: "Workload balancing",
    });
  });

  it("skips assignment audit when assignedTo is unchanged", async () => {
    mocks.state.existingLead.assignedTo = "agent-2";
    mocks.state.updatedLead = { id: "lead-1", assignedTo: "agent-2", leadStatus: "new" };

    const { leadService } = await import("./leadService.js");
    const { recordLeadAssignment } = await import("./leadAssignmentService.js");

    await leadService.updateLead({
      leadId: "lead-1",
      actingUserId: "manager-1",
      payload: {
        assignedTo: "agent-2",
      },
    });

    expect(recordLeadAssignment).not.toHaveBeenCalled();
  });
});
