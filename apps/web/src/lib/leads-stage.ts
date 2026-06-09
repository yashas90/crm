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
    chipClass: "bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    id: "new",
    label: "New",
    chipClass: "bg-sky-500/10 text-sky-800 hover:bg-sky-500/15 dark:text-sky-300",
  },
  {
    id: "pending",
    label: "Pending",
    chipClass: "bg-amber-500/10 text-amber-900 hover:bg-amber-500/15 dark:text-amber-300",
  },
  {
    id: "scheduled",
    label: "Callback",
    chipClass: "bg-violet-500/10 text-violet-800 hover:bg-violet-500/15 dark:text-violet-300",
  },
  {
    id: "overdue",
    label: "Overdue",
    chipClass: "bg-rose-500/10 text-rose-800 hover:bg-rose-500/15 dark:text-rose-300",
  },
  {
    id: "eoi",
    label: "Expression of Interest",
    chipClass: "bg-teal-500/10 text-teal-800 hover:bg-teal-500/15 dark:text-teal-300",
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
  followUpDueBefore?: string;
  followUpDueAfter?: string;
  orderByFollowUp?: string;
};

/**
 * Map a stage chip to list API filters.
 * - Pending uses lead_status=contacted (awaiting agent action).
 * - EOI uses lead_status=qualified (pipeline stage before negotiation).
 */
export function stageToQueryParams(stage: LeadsStage): StageQuerySlice {
  const now = new Date().toISOString();

  switch (stage) {
    case "active":
      return { activeOnly: "true" };
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
      return { activeOnly: "true" };
  }
}
