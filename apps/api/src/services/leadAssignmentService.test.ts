import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const state = {
    assignments: [
      {
        id: "assign-1",
        leadId: "lead-1",
        fromAgentId: null as string | null,
        toAgentId: "agent-1",
        assignedBy: "manager-1",
        reason: "Initial assignment",
        assignedAt: new Date("2025-06-12T10:00:00.000Z"),
      },
      {
        id: "assign-2",
        leadId: "lead-1",
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        assignedBy: "manager-1",
        reason: null,
        assignedAt: new Date("2025-06-15T10:00:00.000Z"),
      },
    ],
    users: [
      { id: "agent-1", name: "Ravi" },
      { id: "agent-2", name: "Priya" },
      { id: "manager-1", name: "Manager" },
    ],
    inserted: [] as unknown[],
  };

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: async () => {
            if (table && typeof table === "object" && table !== null && "leadId" in table) {
              return state.assignments;
            }
            return [];
          },
          limit: async () => state.assignments.slice(0, 1),
        }),
      }),
    }),
    insert: () => ({
      values: (row: unknown) => ({
        returning: async () => {
          state.inserted.push(row);
          return [{ id: "new-assign", ...(row as object) }];
        },
      }),
    }),
  };

  return { state, db };
});

vi.mock("../lib/db.js", () => ({
  db: dbMocks.db,
}));

describe("leadAssignmentService", () => {
  beforeEach(() => {
    dbMocks.state.inserted = [];
    vi.clearAllMocks();
  });

  it("returns assignment history with joined agent names", async () => {
    let selectCall = 0;
    const originalSelect = dbMocks.db.select;
    dbMocks.db.select = () => ({
      from: () => ({
        where: () => {
          selectCall += 1;
          if (selectCall === 1) {
            return {
              orderBy: async () =>
                [...dbMocks.state.assignments].sort(
                  (a, b) => b.assignedAt.getTime() - a.assignedAt.getTime(),
                ),
            };
          }
          return Promise.resolve(dbMocks.state.users);
        },
      }),
    });

    const { getAssignmentHistory } = await import("./leadAssignmentService.js");
    const items = await getAssignmentHistory("lead-1");

    dbMocks.db.select = originalSelect;

    expect(items).toHaveLength(2);
    expect(items[0]?.toAgentName).toBe("Priya");
    expect(items[0]?.fromAgentName).toBe("Ravi");
    expect(items[0]?.assignedByName).toBe("Manager");
    expect(items[1]?.fromAgentName).toBeNull();
    expect(items[1]?.toAgentName).toBe("Ravi");
    expect(items[1]?.reason).toBe("Initial assignment");
  });

  it("records a lead assignment row", async () => {
    const { recordLeadAssignment } = await import("./leadAssignmentService.js");

    const row = await recordLeadAssignment(dbMocks.db as never, {
      leadId: "lead-1",
      fromAgentId: "agent-1",
      toAgentId: "agent-2",
      assignedBy: "manager-1",
      reason: "  Territory change  ",
    });

    expect(row).toMatchObject({
      leadId: "lead-1",
      toAgentId: "agent-2",
      reason: "Territory change",
    });
    expect(dbMocks.state.inserted).toHaveLength(1);
  });
});
