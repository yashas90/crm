import type { LeadStatus } from "@propninja/types/enums";

export const SLA_ACTIVE_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "negotiation"];

export const SLA_THRESHOLD_DAYS = [1, 3, 7, 14] as const;
export const SLA_DEFAULT_INACTIVE_DAYS = 3;

export type SlaSummary = {
  inactive_1d: number;
  inactive_3d: number;
  inactive_7d: number;
  inactive_14d: number;
  flagged: number;
  defaultInactiveDays: number;
  thresholds: number[];
};

export type SlaBreachedLead = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  leadStatus: string;
  assignedTo: string | null;
  lastActivityAt: string | null;
  lastContactedAt: string | null;
  slaBreachedAt: string | null;
  createdAt: string;
  inactiveSince: string;
  daysSinceActivity: number;
  assignedUser: { id: string; name: string } | null;
};

export type SlaBreachedList = {
  items: SlaBreachedLead[];
  total: number;
  page: number;
  pageSize: number;
  inactiveDays: number;
};

export type SlaSeverity = "ok" | "warning" | "breach" | "critical" | "na";

export type LeadSlaState = {
  applies: boolean;
  severity: SlaSeverity;
  daysSinceActivity: number;
  lastEngagementAt: string | null;
  thresholdDays: number;
  label: string;
};

export function lastEngagementAt(lead: {
  lastActivityAt?: string | null;
  lastContactedAt?: string | null;
  createdAt?: string | null;
}): string | null {
  return lead.lastActivityAt ?? lead.lastContactedAt ?? lead.createdAt ?? null;
}

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function computeLeadSlaState(
  lead: {
    leadStatus: string;
    lastActivityAt?: string | null;
    lastContactedAt?: string | null;
    createdAt?: string | null;
    slaBreachedAt?: string | null;
  },
  thresholdDays = SLA_DEFAULT_INACTIVE_DAYS,
): LeadSlaState {
  const applies = (SLA_ACTIVE_STATUSES as string[]).includes(lead.leadStatus);
  if (!applies) {
    return {
      applies: false,
      severity: "na",
      daysSinceActivity: 0,
      lastEngagementAt: lastEngagementAt(lead),
      thresholdDays,
      label: "Not in SLA scope",
    };
  }

  const engagement = lastEngagementAt(lead);
  const inactiveDays = daysSince(engagement);

  let severity: SlaSeverity = "ok";
  if (inactiveDays >= 14) severity = "critical";
  else if (inactiveDays >= thresholdDays || Boolean(lead.slaBreachedAt)) severity = "breach";
  else if (inactiveDays >= 1) severity = "warning";

  const label =
    severity === "ok"
      ? "Active"
      : severity === "warning"
        ? `Inactive ${inactiveDays}d`
        : severity === "breach"
          ? `SLA breach (${inactiveDays}d)`
          : `Critical (${inactiveDays}d)`;

  return {
    applies: true,
    severity,
    daysSinceActivity: inactiveDays,
    lastEngagementAt: engagement,
    thresholdDays,
    label,
  };
}

export const SLA_THRESHOLD_LABELS: Record<number, string> = {
  1: "1+ day inactive",
  3: "3+ days (default SLA)",
  7: "7+ days inactive",
  14: "14+ days critical",
};
