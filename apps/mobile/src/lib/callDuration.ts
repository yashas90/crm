/** Minimum time away before auto-opening the call log sheet (accidental dial guard). */
export const MIN_CALL_LOG_ELAPSED_MS = 5_000;

/**
 * Whole minutes elapsed between call start and end (or now).
 * Returns 0 when start is missing or in the future.
 */
export function calculateCallDurationMinutes(
  callStartTimeMs: number | null | undefined,
  endTimeMs: number = Date.now(),
): number {
  if (callStartTimeMs == null || !Number.isFinite(callStartTimeMs)) {
    return 0;
  }

  const elapsedMs = endTimeMs - callStartTimeMs;
  if (elapsedMs < 0) {
    return 0;
  }

  return Math.round(elapsedMs / 1000 / 60);
}

/** Whether the agent was away long enough to treat the dialer session as a real call. */
export function shouldOpenCallLogSheet(
  callStartTimeMs: number | null | undefined,
  endTimeMs: number = Date.now(),
): boolean {
  if (callStartTimeMs == null || !Number.isFinite(callStartTimeMs)) {
    return false;
  }

  const elapsedMs = endTimeMs - callStartTimeMs;
  return elapsedMs >= MIN_CALL_LOG_ELAPSED_MS;
}

export function callStartIso(callStartTimeMs: number): string {
  return new Date(callStartTimeMs).toISOString();
}
