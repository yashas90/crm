/** Format talk time for call-log rows. Sub-minute calls must not round to "0m". */
export function formatCallLogDuration(durationSeconds: number): string {
  const s = Math.max(0, Math.round(durationSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

/**
 * Zero talk time cannot be "Answered" — even if a stale row still has that outcome.
 */
export function displayCallOutcome(outcome: string | null, durationSeconds: number): string | null {
  if (outcome === "answered" && durationSeconds <= 0) return "no_answer";
  return outcome;
}
