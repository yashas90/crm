import { invalidateQueriesAfterCallLog } from "@/lib/invalidateQueriesAfterCallLog";

/**
 * Contract after fire-and-forget invalidation (useLogCall does not await):
 * - Mounted Today / Leads observers must get an *active* refetch so the logged
 *   call shows up when the list screen is opened right after logging.
 * - Never pass refetchType:"none" — that fixed lag but left stale lists.
 * Device check still required: log → open list immediately → count/status update.
 */
describe("invalidateQueriesAfterCallLog", () => {
  it("invalidates calls, reports, leads, and tasks with active refetch (no refetchType:none)", () => {
    const invalidateQueries = jest.fn();
    const queryClient = { invalidateQueries };

    invalidateQueriesAfterCallLog(queryClient, { lead_id: "lead-abc" }, "user-123");

    const calls = invalidateQueries.mock.calls.map((c) => c[0]);

    expect(calls).toEqual(
      expect.arrayContaining([
        { queryKey: ["calls"] },
        { queryKey: ["reports"] },
        { queryKey: ["leads"] },
        { queryKey: ["tasks"] },
        { queryKey: ["leads", "lead-abc"] },
        { queryKey: ["calls", "today", "user-123"] },
        { queryKey: ["calls", "summary", "today", "user-123"] },
      ]),
    );

    // Regression: soft-stale-only (refetchType:"none") left Today/leads lists showing
    // old call counts / New status until a later navigation. Active refetch required.
    for (const opts of calls) {
      expect(opts).not.toHaveProperty("refetchType", "none");
      // Default RQ active refetch — omit refetchType entirely (same as active).
      expect(opts.refetchType).toBeUndefined();
    }
  });

  it("keeps lead-list + today-calls keys active so open-list-after-log reflects the call", () => {
    const invalidateQueries = jest.fn();
    invalidateQueriesAfterCallLog({ invalidateQueries }, { lead_id: "lead-xyz" }, "agent-1");

    const byKey = Object.fromEntries(
      invalidateQueries.mock.calls.map((c) => [JSON.stringify(c[0].queryKey), c[0]]),
    );

    // These are the mounted queries on Today / Leads after navigating back from detail.
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
