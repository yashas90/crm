import { invalidateQueriesAfterCallLog } from "@/lib/invalidateQueriesAfterCallLog";

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
