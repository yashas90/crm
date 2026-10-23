/**
 * Which stored Meta leadgen deliveries still need a Graph re-pull.
 * A failed ingest used to wait for the next form scan, and that scan can
 * miss the lead once it falls outside the page cap or the time window.
 */

export const META_FAILED_LEAD_MAX_ATTEMPTS = 200;
/** Fast retries (every 30s). After this, only the deeper pull keeps going. */
export const META_FAILED_LEAD_FAST_ATTEMPTS = 40;
export const META_FAILED_LEAD_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
/** Queued/processing rows younger than this may still be in the webhook worker. */
export const META_STUCK_LEAD_MS = 3 * 60 * 1000;

const STUCK_STATUSES = new Set(["queued", "processing", "received"]);

export type FailedLeadRetryRow = {
  status: string;
  retryCount: number;
  createdAt: Date;
};

export function isMetaLeadRetryDue(
  row: FailedLeadRetryRow,
  now = Date.now(),
  thorough = false,
): boolean {
  const age = now - row.createdAt.getTime();
  if (age < 0 || age > META_FAILED_LEAD_MAX_AGE_MS) return false;
  if (row.retryCount >= META_FAILED_LEAD_MAX_ATTEMPTS) return false;

  if (row.status === "failed") {
    return thorough || row.retryCount < META_FAILED_LEAD_FAST_ATTEMPTS;
  }

  if (STUCK_STATUSES.has(row.status)) {
    return age >= META_STUCK_LEAD_MS;
  }

  return false;
}
