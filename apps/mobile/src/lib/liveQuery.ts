/** Background-safe polling interval for live CRM data (leads, tasks, calls). */
export const LIVE_REFETCH_MS = 60_000;

export function liveQueryOptions() {
  return {
    refetchInterval: LIVE_REFETCH_MS,
    refetchIntervalInBackground: false,
  } as const;
}
