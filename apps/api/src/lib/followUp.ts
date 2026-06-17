export const COLD_LEAD_DAYS = 7;
export const FOLLOWUP_REMINDER_MINUTES = 30;

export function daysSinceContact(
  lastContactedAt: Date | string | null | undefined,
  createdAt?: Date | string | null,
  now = new Date(),
): number {
  const anchor = lastContactedAt
    ? new Date(lastContactedAt)
    : createdAt
      ? new Date(createdAt)
      : now;
  const diffMs = now.getTime() - anchor.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export function isColdLead(
  lastContactedAt: Date | string | null | undefined,
  createdAt: Date | string,
  now = new Date(),
): boolean {
  return daysSinceContact(lastContactedAt, createdAt, now) >= COLD_LEAD_DAYS;
}

export function isFollowUpOverdue(
  nextFollowupAt: Date | string | null | undefined,
  now = new Date(),
) {
  if (!nextFollowupAt) return false;
  return new Date(nextFollowupAt) < now;
}

export function isFollowUpDueToday(
  nextFollowupAt: Date | string | null | undefined,
  now = new Date(),
) {
  if (!nextFollowupAt) return false;
  const date = new Date(nextFollowupAt);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

export function daysOverdue(nextFollowupAt: Date | string, now = new Date()): number {
  const due = new Date(nextFollowupAt);
  if (due >= now) return 0;
  return Math.max(1, Math.floor((now.getTime() - due.getTime()) / 86_400_000));
}

export function coldCutoffDate(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - COLD_LEAD_DAYS);
  return cutoff;
}
