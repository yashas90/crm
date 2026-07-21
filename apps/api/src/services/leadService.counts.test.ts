import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    selectCalls: 0,
    throwOnSelect: false,
  };

  const resultsQueue: Array<Record<string, unknown>[]> = [];

  const db = {
    select: vi.fn((_shape?: Record<string, unknown>) => {
      state.selectCalls += 1;
      if (state.throwOnSelect) {
        throw new Error("db down");
      }
      return {
        from: () => ({
          where: async () => {
            const next = resultsQueue.shift();
            if (!next) {
              throw new Error("No mocked query result queued");
            }
            return next;
          },
        }),
      };
    }),
    queueResults(...batches: Array<Record<string, unknown>[]>) {
      resultsQueue.push(...batches);
    },
    resetQueue() {
      resultsQueue.length = 0;
    },
  };

  return { state, db };
});

vi.mock("../lib/db.js", () => ({
  db: mocks.db,
}));

vi.mock("./leadAssignmentService.js", () => ({
  recordLeadAssignment: vi.fn(),
}));

vi.mock("./leadScoringService.js", () => ({
  recalculateLeadScore: vi.fn(),
  getLeadScoreBreakdown: vi.fn(),
}));

vi.mock("../lib/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("leadService count aggregates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.selectCalls = 0;
    mocks.state.throwOnSelect = false;
    mocks.db.resetQueue();
  });

  it("returns every scope bucket from fast + bucket aggregate queries", async () => {
    const { leadService } = await import("./leadService.js");
    mocks.db.queueResults(
      [
        {
          all: 10,
          my: 4,
          teams: 3,
          unassigned: 2,
          naleads: 6,
        },
      ],
      [{ count: 7 }],
      [{ count: 5 }],
      [{ count: 1 }],
    );

    const counts = await leadService.getScopeCounts(
      { search: "mumbai" },
      { userId: "user-1", isAgent: false },
    );

    expect(mocks.state.selectCalls).toBe(4);
    expect(counts).toEqual({
      all: 10,
      my: 4,
      teams: 3,
      unassigned: 2,
      deleted: 7,
      duplicate: 5,
      "re-enquired": 1,
      naleads: 6,
    });
  });

  it("returns every stage bucket from one conditional aggregate query", async () => {
    const { leadService } = await import("./leadService.js");
    mocks.db.queueResults([
      {
        active: 11,
        new: 3,
        pending: 2,
        scheduled: 4,
        overdue: 1,
        eoi: 5,
      },
    ]);

    const counts = await leadService.getStageCounts({ assignedTo: "user-1" });

    expect(mocks.state.selectCalls).toBe(1);
    expect(counts).toEqual({
      active: 11,
      new: 3,
      pending: 2,
      scheduled: 4,
      overdue: 1,
      eoi: 5,
    });
  });

  it("returns zeroed scope buckets when the aggregate query fails", async () => {
    const { leadService } = await import("./leadService.js");
    const { logger } = await import("../lib/logger.js");
    mocks.state.throwOnSelect = true;

    const counts = await leadService.getScopeCounts({}, { userId: "user-1", isAgent: true });

    expect(counts).toEqual({
      all: 0,
      my: 0,
      teams: 0,
      unassigned: 0,
      deleted: 0,
      duplicate: 0,
      "re-enquired": 0,
      naleads: 0,
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it("returns zeroed stage buckets when the aggregate query fails", async () => {
    const { leadService } = await import("./leadService.js");
    mocks.state.throwOnSelect = true;

    const counts = await leadService.getStageCounts({});

    expect(counts).toEqual({
      active: 0,
      new: 0,
      pending: 0,
      scheduled: 0,
      overdue: 0,
      eoi: 0,
    });
  });

  it("strips naleads for non-admin tab counts", async () => {
    const { leadService } = await import("./leadService.js");
    mocks.db.queueResults(
      [
        {
          all: 1,
          my: 1,
          teams: 0,
          unassigned: 0,
          naleads: 9,
        },
      ],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
      [
        {
          active: 1,
          new: 1,
          pending: 0,
          scheduled: 0,
          overdue: 0,
          eoi: 0,
        },
      ],
    );

    const data = await leadService.getTabCounts(
      {},
      {},
      {
        userId: "user-1",
        isAgent: false,
        isAdmin: false,
      },
    );

    expect(data.scope.naleads).toBeUndefined();
    expect(data.stage.new).toBe(1);
  });
});
