export const DEFAULT_SITE_VISIT_REMINDER_MINUTES = [24 * 60, 2 * 60, 30] as const;

/** Sentinel tier for 8 AM IST day-of-visit WhatsApp to client. Never conflicts with minute-based tiers. */
export const DAY_OF_8AM_TIER = 99999;

export type SiteVisitReminderTier = {
  tierMinutes: number;
  sentAt: string;
};

export function parseSiteVisitReminderMinutes(
  settings: Record<string, unknown> | null | undefined,
): number[] {
  const raw = settings?.siteVisitReminderMinutes;
  if (!Array.isArray(raw)) return [...DEFAULT_SITE_VISIT_REMINDER_MINUTES];
  const parsed = raw
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 7 * 24 * 60);
  return parsed.length > 0
    ? [...new Set(parsed)].sort((a, b) => b - a)
    : [...DEFAULT_SITE_VISIT_REMINDER_MINUTES];
}

export function resolveOrgTimezone(settings: Record<string, unknown> | null | undefined): string {
  const tz = settings?.timezone;
  return typeof tz === "string" && tz.trim() ? tz : "Asia/Kolkata";
}

export function hasReminderTierSent(
  remindersSent: SiteVisitReminderTier[] | null | undefined,
  tierMinutes: number,
): boolean {
  return (remindersSent ?? []).some((entry) => entry.tierMinutes === tierMinutes);
}

export function appendReminderTier(
  remindersSent: SiteVisitReminderTier[] | null | undefined,
  tierMinutes: number,
  sentAt = new Date().toISOString(),
): SiteVisitReminderTier[] {
  const next = [...(remindersSent ?? [])];
  if (!hasReminderTierSent(next, tierMinutes)) {
    next.push({ tierMinutes, sentAt });
  }
  return next;
}
