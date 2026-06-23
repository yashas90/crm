import { formatDateTimeIst, todayRangeIst } from "@propninja/types/ist";

export function todayRange() {
  return todayRangeIst();
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

/** Past timestamps: "Today", "3 days ago", etc. Future: formatted date/time. */
export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    return formatDateTime(value);
  }
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function formatDateTime(value: string | null | undefined) {
  return formatDateTimeIst(value);
}
