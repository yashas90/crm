import { getCurrentUserId, getUser, normalizeRole } from "@/lib/auth";
import {
  type LeadsAdvancedFilters,
  advancedFiltersToApiQuery,
  countActiveAdvancedFilters,
  defaultLeadsAdvancedFilters,
} from "@propninja/types/filters";

export type { LeadsAdvancedFilters };
export { defaultLeadsAdvancedFilters, countActiveAdvancedFilters };

export type MobileLeadScope = "all" | "my" | "teams" | "unassigned";

export type MobileLeadFilters = LeadsAdvancedFilters & {
  scope: MobileLeadScope;
  status: string;
  source: string;
  temperature: string;
};

export function defaultMobileLeadFilters(isAgent = false): MobileLeadFilters {
  return {
    ...defaultLeadsAdvancedFilters(),
    scope: isAgent ? "my" : "all",
    status: "",
    source: "",
    temperature: "",
  };
}

function defaultScopeForRole(isAgent: boolean): MobileLeadScope {
  return isAgent ? "my" : "all";
}

export function countActiveMobileLeadFilters(
  filters: MobileLeadFilters,
  options?: { isAgent?: boolean },
): number {
  let count = countActiveAdvancedFilters(filters);
  const defaultScope = defaultScopeForRole(options?.isAgent ?? false);
  if (filters.scope !== defaultScope) count += 1;
  if (filters.status) count += 1;
  if (filters.source) count += 1;
  if (filters.temperature) count += 1;
  return count;
}

/** Map mobile filter state to flat API query params for GET /api/leads. */
export function mobileFiltersToApiParams(filters: MobileLeadFilters): Record<string, string> {
  const out: Record<string, string> = {};
  const setBool = (key: string, value?: boolean) => {
    if (value) out[key] = "true";
  };
  const setStr = (key: string, value?: string) => {
    if (value) out[key] = value;
  };
  const setNum = (key: string, value?: number) => {
    if (value !== undefined) out[key] = String(value);
  };

  const api = advancedFiltersToApiQuery(filters);
  const userId = getCurrentUserId();

  if (filters.scope === "my" && userId && !filters.filterAssignTo) {
    out.assignedTo = userId;
  } else if (filters.filterAssignTo) {
    out.assignedTo = filters.filterAssignTo;
  }
  if (filters.scope === "unassigned") out.unassigned = "true";
  if (filters.scope === "teams" || filters.assignWithTeam) out.teamLeads = "true";

  setBool("assignWithHistory", api.assignWithHistory);
  setStr("assignedFrom", api.assignedFrom);
  setStr("assignedBy", api.assignedBy);
  setStr("originalOwner", api.originalOwner);
  setStr("subStatus", api.subStatus);
  setStr("subSource", api.subSource);
  if (api.tagPresets?.length) out.tagPresets = api.tagPresets.join(",");
  setBool("meetingDone", api.meetingDone);
  setBool("meetingNotDone", api.meetingNotDone);
  setBool("siteVisitDone", api.siteVisitDone);
  setBool("siteVisitNotDone", api.siteVisitNotDone);
  setStr("projectStatus", api.projectStatus);
  if (filters.filterProjectId) out.projectId = filters.filterProjectId;
  setBool("hasProject", api.hasProject);
  setStr("possessionFrom", api.possessionFrom);
  setStr("possessionTo", api.possessionTo);
  setStr("city", api.city);
  setStr("state", api.state);
  setStr("locality", api.locality);
  setStr("country", api.country);
  setStr("zone", api.zone);
  setNum("latitude", api.latitude);
  setNum("longitude", api.longitude);
  setNum("radiusKm", api.radiusKm);
  setStr("countryCode", api.countryCode);
  setStr("altCountryCode", api.altCountryCode);
  setStr("customerCountry", api.customerCountry);
  setStr("propertyStatus", api.propertyStatus);
  setStr("propertyType", api.propertyType);
  setStr("propertySubType", api.propertySubType);
  setStr("bhk", api.bhk);
  setStr("bhkType", api.bhkType);
  setNum("minBudgetFrom", api.minBudgetFrom);
  setNum("minBudgetTo", api.minBudgetTo);
  setNum("maxBudgetFrom", api.maxBudgetFrom);
  setNum("maxBudgetTo", api.maxBudgetTo);
  setNum("carpetAreaFrom", api.carpetAreaFrom);
  setNum("carpetAreaTo", api.carpetAreaTo);
  setNum("builtUpAreaFrom", api.builtUpAreaFrom);
  setNum("builtUpAreaTo", api.builtUpAreaTo);

  if (filters.status) out.status = filters.status;
  if (filters.source) out.source = filters.source;
  if (filters.temperature) out.temperature = filters.temperature;

  const isAgent = normalizeRole(getUser()?.role ?? "agent") === "agent";
  if (isAgent) {
    const userId = getCurrentUserId();
    if (userId) out.assignedTo = userId;
  }

  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(out)) {
    if (typeof value !== "string" || value.length === 0) continue;
    if (isAgent && (key === "unassigned" || key === "teamLeads")) continue;
    cleaned[key] = value;
  }

  return cleaned;
}
