import type { LeadsUrlFilters } from "@/lib/leads-url-filters";

/** Pipeline stage chips shown below scope tabs on the leads list. */
export type LeadsStage = "active" | "new" | "pending" | "scheduled" | "overdue" | "eoi";

export type LeadStageCounts = Record<LeadsStage, number>;

export const LEAD_STAGES: {
  id: LeadsStage;
  label: string;
  chipClass: string;
}[] = [
  {
    id: "active",
    label: "Active Leads",
    chipClass:
      "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100",
  },
  {
    id: "new",
    label: "New",
    chipClass:
      "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100",
  },
  {
    id: "pending",
    label: "Pending",
    chipClass:
      "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100",
  },
  {
    id: "scheduled",
    label: "Callback",
    chipClass:
      "border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100",
  },
  {
    id: "overdue",
    label: "Overdue",
    chipClass:
      "border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100",
  },
  {
    id: "eoi",
    label: "Expression of Interest",
    chipClass:
      "border-teal-300 bg-teal-100 text-teal-950 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-100",
  },
];

export function defaultLeadsStage(): LeadsStage {
  return "active";
}

/** Inverse of stageFromUrlFilters — writes bookmarkable query params. */
export function stageToUrlParams(stage: LeadsStage): {
  status?: string;
  active?: string;
  followUp?: string;
} {
  switch (stage) {
    case "active":
      return { active: "true" };
    case "new":
      return { status: "new" };
    case "pending":
      return { status: "contacted" };
    case "scheduled":
      return { followUp: "upcoming" };
    case "overdue":
      return { followUp: "overdue" };
    case "eoi":
      return { status: "qualified" };
    default:
      return { active: "true" };
  }
}

export function stageFromUrlFilters(filters: LeadsUrlFilters): LeadsStage {
  if (filters.activeOnly) return "active";
  if (filters.status === "new") return "new";
  if (filters.status === "contacted") return "pending";
  if (filters.status === "qualified") return "eoi";
  if (filters.followUpFilter === "overdue") return "overdue";
  if (filters.followUpFilter === "upcoming" || filters.followUpFilter === "due_today") {
    return "scheduled";
  }
  return "active";
}

type StageQuerySlice = {
  status?: string;
  activeOnly?: string;
  excludeNew?: string;
  followUpDueBefore?: string;
  followUpDueAfter?: string;
  orderByFollowUp?: string;
};

/**
 * Map a stage chip to list API filters.
 * - Active = open pipeline excluding untouched `new` (worked / updated leads).
 * - New = `lead_status=new` and created within 24h (API enforces freshness).
 * - Pending = `lead_status=contacted` (called/touched or aged past 24h).
 * - EOI uses lead_status=qualified (pipeline stage before negotiation).
 */
export function stageToQueryParams(stage: LeadsStage): StageQuerySlice {
  const now = new Date().toISOString();

  switch (stage) {
    case "active":
      return { activeOnly: "true", excludeNew: "true" };
    case "new":
      return { status: "new" };
    case "pending":
      return { status: "contacted" };
    case "scheduled":
      return {
        followUpDueAfter: now,
        activeOnly: "true",
        orderByFollowUp: "true",
      };
    case "overdue":
      return {
        followUpDueBefore: now,
        activeOnly: "true",
        orderByFollowUp: "true",
      };
    case "eoi":
      return { status: "qualified" };
    default:
      return { activeOnly: "true", excludeNew: "true" };
  }
}
