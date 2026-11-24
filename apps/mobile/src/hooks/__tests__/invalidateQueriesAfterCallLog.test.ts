import { invalidateQueriesAfterCallLog } from "@/lib/invalidateQueriesAfterCallLog";

/**
 * Contract after fire-and-forget invalidation (useLogCall does not await):
 * - Mounted Today / Leads observers must get an *active* refetch so the logged
 *   call shows up when the list screen is opened right after logging.
 * - Heavy reports/tasks are deferred so rapid dialing does not LMK-kill the app.
 * Device check still required: log → open list immediately → count/status update.
 */
describe("invalidateQueriesAfterCallLog", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("invalidates calls + leads immediately; defers reports/tasks", () => {
    const invalidateQueries = jest.fn();
    const queryClient = { invalidateQueries };

    invalidateQueriesAfterCallLog(queryClient, { lead_id: "lead-abc" }, "user-123");

    const immediate = invalidateQueries.mock.calls.map((c) => c[0]);

    expect(immediate).toEqual(
      expect.arrayContaining([
        { queryKey: ["calls"] },
        { queryKey: ["leads"] },
        { queryKey: ["leads", "lead-abc"] },
        { queryKey: ["calls", "today", "user-123"] },
        { queryKey: ["calls", "summary", "today", "user-123"] },
      ]),
    );
    expect(immediate.some((opts) => opts.queryKey[0] === "reports")).toBe(false);
    expect(immediate.some((opts) => opts.queryKey[0] === "tasks")).toBe(false);

    for (const opts of immediate) {
      expect(opts).not.toHaveProperty("refetchType", "none");
      expect(opts.refetchType).toBeUndefined();
    }

    jest.advanceTimersByTime(2_500);
    const deferred = invalidateQueries.mock.calls.map((c) => c[0]);
    expect(deferred).toEqual(
      expect.arrayContaining([{ queryKey: ["reports"] }, { queryKey: ["tasks"] }]),
    );
  });

  it("keeps lead-list + today-calls keys active so open-list-after-log reflects the call", () => {
    const invalidateQueries = jest.fn();
    invalidateQueriesAfterCallLog({ invalidateQueries }, { lead_id: "lead-xyz" }, "agent-1");

    const byKey = Object.fromEntries(
      invalidateQueries.mock.calls.map((c) => [JSON.stringify(c[0].queryKey), c[0]]),
    );

    for (const key of [
      ["leads"],
      ["leads", "lead-xyz"],
      ["calls", "today", "agent-1"],
      ["calls", "summary", "today", "agent-1"],
    ]) {
      const opts = byKey[JSON.stringify(key)];
      expect(opts).toBeDefined();
      expect(opts.refetchType).toBeUndefined();
    }
  });

  it("still invalidates lead lists when lead_id is omitted", () => {
    const invalidateQueries = jest.fn();
    invalidateQueriesAfterCallLog({ invalidateQueries }, {}, null);

    const keys = invalidateQueries.mock.calls.map((c) => c[0].queryKey);
    expect(keys).toContainEqual(["leads"]);
    expect(keys).toContainEqual(["calls"]);
    expect(keys.some((k: unknown[]) => k[0] === "leads" && k.length > 1)).toBe(false);
  });
});
