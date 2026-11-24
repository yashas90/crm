/**
 * Cache refresh after a successful call log.
 * Keep the hot path narrow so logging 10+ calls does not trigger a refetch storm
 * (reports/tasks deferred) that can LMK-kill the Android process.
 */
export function invalidateQueriesAfterCallLog(
  queryClient: {
    invalidateQueries: (opts: { queryKey: readonly unknown[]; refetchType?: string }) => unknown;
  },
  variables: { lead_id?: string },
  userId: string | null | undefined,
): void {
  void queryClient.invalidateQueries({ queryKey: ["calls"] });
  if (variables.lead_id) {
    void queryClient.invalidateQueries({ queryKey: ["leads", variables.lead_id] });
  }
  // Lead lists still need an active refresh so Today / queue reflect the call.
  void queryClient.invalidateQueries({ queryKey: ["leads"] });
  if (userId) {
    void queryClient.invalidateQueries({ queryKey: ["calls", "today", userId] });
    void queryClient.invalidateQueries({ queryKey: ["calls", "summary", "today", userId] });
  }

  // Defer heavy report/task trees so they do not stack on every dialer return.
  setTimeout(() => {
    void queryClient.invalidateQueries({ queryKey: ["reports"] });
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }, 2_500);
}
