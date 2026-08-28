import type { LeadsUrlFilters } from "@/lib/leads-url-filters";

export type LeadsScope =
  | "all"
  | "my"
  | "teams"
  | "unassigned"
  | "deleted"
  | "duplicate"
  | "re-enquired"
  | "naleads"
  | "sla";

export type LeadScopeCounts = Record<LeadsScope, number> & { naleads?: number };

export const LEADS_QUICK_FILTER_TABS: { id: LeadsScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "my", label: "My Leads" },
  { id: "teams", label: "Team's" },
  { id: "unassigned", label: "Unassigned" },
  { id: "deleted", label: "Deleted" },
  { id: "duplicate", label: "Duplicate" },
  { id: "re-enquired", label: "Re-Enquired" },
  { id: "sla", label: "SLA" },
];

/** @deprecated Use LEADS_QUICK_FILTER_TABS */
export const LEADS_SCOPES = LEADS_QUICK_FILTER_TABS;

const VALID_SCOPES = new Set<LeadsScope>([
  "all",
  "my",
  "teams",
  "unassigned",
  "deleted",
  "duplicate",
  "re-enquired",
  "naleads",
  "sla",
]);

export function scopeFromSearchParams(
  params: URLSearchParams,
  filters: LeadsUrlFilters,
): LeadsScope {
  const explicit = params.get("scope");
  if (explicit && VALID_SCOPES.has(explicit as LeadsScope)) {
    return explicit as LeadsScope;
  }
  if (filters.unassigned) return "unassigned";
  if (filters.myLeadsOnly) return "my";
  return "all";
}

export function scopeFromUrlFilters(
  filters: LeadsUrlFilters,
  params?: URLSearchParams,
): LeadsScope {
  if (params) return scopeFromSearchParams(params, filters);
  if (filters.unassigned) return "unassigned";
  if (filters.myLeadsOnly) return "my";
  return "all";
}

/** Map UI scope to API query flags (works alongside search/status/temperature filters). */
/** Stage chips (active/new/pending/…) conflict with these bucket scopes — skip them in list queries. */
export function scopeUsesStageFilters(scope: LeadsScope): boolean {
  return !(
    scope === "naleads" ||
    scope === "deleted" ||
    scope === "duplicate" ||
    scope === "re-enquired" ||
    scope === "sla"
  );
}

export function scopeToQueryParams(
  scope: LeadsScope,
  userId?: string,
): {
  assignedTo?: string;
  unassigned?: string;
  deletedOnly?: string;
  teamLeads?: string;
  duplicatesOnly?: string;
  excludeDuplicates?: string;
  reEnquiredOnly?: string;
  naLeadsOnly?: string;
  slaOnly?: string;
} {
  switch (scope) {
    case "my":
      return userId
        ? { assignedTo: userId, excludeDuplicates: "true" }
        : { excludeDuplicates: "true" };
    case "teams":
      return userId
        ? { teamLeads: "true", excludeDuplicates: "true" }
        : { excludeDuplicates: "true" };
    case "unassigned":
      return { unassigned: "true", excludeDuplicates: "true" };
    case "deleted":
      return { deletedOnly: "true", excludeDuplicates: "true" };
    case "duplicate":
      return { duplicatesOnly: "true" };
    case "re-enquired":
      return { reEnquiredOnly: "true", excludeDuplicates: "true" };
    case "naleads":
      return { naLeadsOnly: "true", excludeDuplicates: "true" };
    case "sla":
      return { slaOnly: "true", excludeDuplicates: "true" };
    default:
      return { excludeDuplicates: "true" };
  }
}
