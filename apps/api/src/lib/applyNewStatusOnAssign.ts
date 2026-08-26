/**
 * Statuses that "… and new status" on assign/import resets to New.
 * Includes Pending (`contacted`) plus NA (`not_interested` / `dropped`).
 * Stale `new` (still New status but showing as Pending) only refreshes freshness.
 */
export const APPLY_NEW_STATUS_SOURCE_STATUSES = [
  "not_interested",
  "dropped",
  "contacted",
  "new",
] as const;

export type ApplyNewStatusSourceStatus = (typeof APPLY_NEW_STATUS_SOURCE_STATUSES)[number];

export function shouldApplyNewStatusOnAssign(currentStatus: string): boolean {
  return (APPLY_NEW_STATUS_SOURCE_STATUSES as readonly string[]).includes(currentStatus);
}

/**
 * Fields to set when assigning with applyNewStatus.
 * Bumps `createdAt` so the lead enters a fresh 24h New window (Pending age-out /
 * list filters key off createdAt).
 */
export function buildApplyNewStatusFields(now: Date = new Date()): {
  leadStatus: "new";
  naSinceAt: null;
  nextFollowupAt: null;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    leadStatus: "new",
    naSinceAt: null,
    nextFollowupAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
