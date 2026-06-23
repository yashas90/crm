import { isFollowUpDueTodayIst } from "@propninja/types/ist";

export const COLD_LEAD_DAYS = 7;

export function daysSinceContact(
  lastContactedAt: string | null | undefined,
  createdAt?: string | null,
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
  lastContactedAt: string | null | undefined,
  createdAt: string,
  coldSince?: string | null,
  now = new Date(),
): boolean {
  if (coldSince) return true;
  return daysSinceContact(lastContactedAt, createdAt, now) >= COLD_LEAD_DAYS;
}

export function isFollowUpOverdue(nextFollowupAt: string | null | undefined, now = new Date()) {
  if (!nextFollowupAt) return false;
  return new Date(nextFollowupAt) < now;
}

export function isFollowUpDueToday(nextFollowupAt: string | null | undefined, now = new Date()) {
  return isFollowUpDueTodayIst(nextFollowupAt, now);
}

export type FollowUpQueueTone = "on_time" | "due_today" | "overdue";

export function followUpQueueTone(
  nextFollowupAt: string | null | undefined,
  now = new Date(),
): FollowUpQueueTone {
  if (isFollowUpOverdue(nextFollowupAt, now)) return "overdue";
  if (isFollowUpDueToday(nextFollowupAt, now)) return "due_today";
  return "on_time";
}

export function contactTooltip(
  lastContactedAt: string | null | undefined,
  createdAt: string,
): string {
  const days = daysSinceContact(lastContactedAt, createdAt);
  if (days === 0) return "Last contacted today";
  if (days === 1) return "Last contacted 1 day ago";
  return `Last contacted ${days} days ago`;
}
