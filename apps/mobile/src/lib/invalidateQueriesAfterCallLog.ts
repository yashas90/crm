/**
 * Cache refresh after a successful call log.
 * Must invalidate with default (active) refetch so mounted lists update;
 * callers must not await this from the mutation critical path.
 */
export function invalidateQueriesAfterCallLog(
  queryClient: {
    invalidateQueries: (opts: { queryKey: readonly unknown[]; refetchType?: string }) => unknown;
  },
  variables: { lead_id?: string },
  userId: string | null | undefined,
): void {
  void queryClient.invalidateQueries({ queryKey: ["calls"] });
  void queryClient.invalidateQueries({ queryKey: ["reports"] });
  void queryClient.invalidateQueries({ queryKey: ["leads"] });
  void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  if (variables.lead_id) {
    void queryClient.invalidateQueries({ queryKey: ["leads", variables.lead_id] });
  }
  if (userId) {
    void queryClient.invalidateQueries({ queryKey: ["calls", "today", userId] });
    void queryClient.invalidateQueries({ queryKey: ["calls", "summary", "today", userId] });
  }
}
