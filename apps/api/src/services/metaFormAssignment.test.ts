import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const updateSet = vi.fn();
  const updateWhere = vi.fn();
  const updateReturning = vi.fn();
  const selectLimit = vi.fn();

  updateReturning.mockImplementation(async () => [{ lastAssignedIndex: 1 }]);
  updateWhere.mockReturnValue({ returning: updateReturning });
  updateSet.mockReturnValue({ where: updateWhere });

  return {
    updateSet,
    updateReturning,
    selectLimit,
    db: {
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: selectLimit,
          }),
        }),
      })),
      update: vi.fn(() => ({
        set: updateSet,
      })),
    },
  };
});

vi.mock("../lib/db.js", () => ({ db: mocks.db }));

const { pickMetaFormAssignee } = await import("./metaFormAssignment.js");

describe("pickMetaFormAssignee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateReturning.mockResolvedValue([{ lastAssignedIndex: 1 }]);
  });

  it("returns null when form has no assignees", async () => {
    mocks.selectLimit.mockResolvedValue([
      {
        id: "form-row",
        assigneeIds: [],
        assignmentStrategy: "round_robin",
        lastAssignedIndex: -1,
      },
    ]);
    await expect(pickMetaFormAssignee("org", "form-1")).resolves.toBeNull();
  });

  it("returns first assignee for first strategy", async () => {
    mocks.selectLimit.mockResolvedValue([
      {
        id: "form-row",
        assigneeIds: ["u1", "u2"],
        assignmentStrategy: "first",
        lastAssignedIndex: -1,
      },
    ]);
    await expect(pickMetaFormAssignee("org", "form-1")).resolves.toBe("u1");
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("round-robins and returns selected assignee", async () => {
    mocks.selectLimit.mockResolvedValue([
      {
        id: "form-row",
        assigneeIds: ["u1", "u2", "u3"],
        assignmentStrategy: "round_robin",
        lastAssignedIndex: 0,
      },
    ]);
    mocks.updateReturning.mockResolvedValue([{ lastAssignedIndex: 1 }]);
    await expect(pickMetaFormAssignee("org", "form-1")).resolves.toBe("u2");
    expect(mocks.db.update).toHaveBeenCalled();
  });
});
