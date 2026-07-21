/**
 * Polling interval for lightweight live data only (notifications, call state).
 * Expensive lead/task/visit lists should refresh on focus + after mutations.
 */
export const LIGHTWEIGHT_LIVE_REFETCH_MS = 60_000;

/** @deprecated Prefer LIGHTWEIGHT_LIVE_REFETCH_MS — kept for call/notification hooks. */
export const LIVE_REFETCH_MS = LIGHTWEIGHT_LIVE_REFETCH_MS;

export function lightweightLiveQueryOptions() {
  return {
    refetchInterval: LIGHTWEIGHT_LIVE_REFETCH_MS,
    refetchIntervalInBackground: false,
  } as const;
}

/** @deprecated Use lightweightLiveQueryOptions() for notifications/calls only. */
export function liveQueryOptions() {
  return lightweightLiveQueryOptions();
}
