import {
  type LeadsAdvancedFilters,
  TAG_PRESET_OPTIONS,
  advancedFiltersToApiQuery,
  countActiveAdvancedFilters,
  defaultLeadsAdvancedFilters,
  tagPresetsToApiParam,
} from "@propninja/types/filters";

export type { LeadsAdvancedFilters };
export {
  TAG_PRESET_OPTIONS,
  advancedFiltersToApiQuery,
  countActiveAdvancedFilters,
  defaultLeadsAdvancedFilters,
  tagPresetsToApiParam,
};

const SAVED_FILTERS_KEY = "propninja_saved_lead_filters";

export type SavedLeadFilter = {
  id: string;
  name: string;
  filters: LeadsAdvancedFilters;
  scope?: string;
};

export function loadSavedLeadFilters(): SavedLeadFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_FILTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLeadFilter[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedLeadFilters(presets: SavedLeadFilter[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(presets));
}

export function addSavedLeadFilter(name: string, filters: LeadsAdvancedFilters, scope?: string) {
  const presets = loadSavedLeadFilters();
  const entry: SavedLeadFilter = {
    id: crypto.randomUUID(),
    name: name.trim(),
    filters,
    scope,
  };
  saveSavedLeadFilters([entry, ...presets].slice(0, 20));
  return entry;
}

/** Serialize advanced filters to URLSearchParams (snake_case keys). */
export function appendAdvancedFiltersToParams(
  params: URLSearchParams,
  filters: LeadsAdvancedFilters,
) {
  const set = (key: string, value: string | boolean | undefined) => {
    if (value === undefined || value === false || value === "") return;
    params.set(key, String(value));
  };

  set("assign_with_history", filters.assignWithHistory);
  set("assign_with_team", filters.assignWithTeam);
  set("filter_assign_to", filters.filterAssignTo);
  set("assigned_from", filters.assignedFrom);
  set("assigned_by", filters.assignedBy);
  set("original_owner", filters.originalOwner);
  set("sub_status", filters.subStatus);
  set("sub_source", filters.subSource);
  const tagPresets = tagPresetsToApiParam(filters.tagPresets);
  if (tagPresets) params.set("tag_presets", tagPresets);
  set("meeting_done", filters.meetingDone);
  set("meeting_not_done", filters.meetingNotDone);
  set("site_visit_done", filters.siteVisitDone);
  set("site_visit_not_done", filters.siteVisitNotDone);
  set("project_status", filters.projectStatus);
  set("filter_project_id", filters.filterProjectId);
  set("associated_projects", filters.associatedProjectsOnly);
  set("property_status", filters.propertyStatus);
  set("property_type", filters.propertyType);
  set("property_sub_type", filters.propertySubType);
  set("bhk", filters.bhk);
  set("bhk_type", filters.bhkType);
  set("possession_from", filters.possessionFrom);
  set("possession_to", filters.possessionTo);
  set("filter_city", filters.filterCity);
  set("filter_state", filters.filterState);
  set("locality", filters.locality);
  set("country", filters.country);
  set("zone", filters.zone);
  set("latitude", filters.latitude);
  set("longitude", filters.longitude);
  set("radius_km", filters.radiusKm);
  set("country_code", filters.countryCode);
  set("alt_country_code", filters.altCountryCode);
  set("customer_country", filters.customerCountry);
  set("min_budget_from", filters.minBudgetFrom);
  set("min_budget_to", filters.minBudgetTo);
  set("max_budget_from", filters.maxBudgetFrom);
  set("max_budget_to", filters.maxBudgetTo);
  set("carpet_area_from", filters.carpetAreaFrom);
  set("carpet_area_to", filters.carpetAreaTo);
  set("built_up_area_from", filters.builtUpAreaFrom);
  set("built_up_area_to", filters.builtUpAreaTo);
}

function boolParam(params: URLSearchParams, key: string): boolean {
  return params.get(key) === "true";
}

export function parseAdvancedFiltersFromParams(params: URLSearchParams): LeadsAdvancedFilters {
  const tagPresetsRaw = params.get("tag_presets") ?? "";
  const tagPresets = tagPresetsRaw
    ? tagPresetsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return {
    ...defaultLeadsAdvancedFilters(),
    assignWithHistory: boolParam(params, "assign_with_history"),
    assignWithTeam: boolParam(params, "assign_with_team"),
    filterAssignTo: params.get("filter_assign_to") ?? "",
    assignedFrom: params.get("assigned_from") ?? "",
    assignedBy: params.get("assigned_by") ?? "",
    originalOwner: params.get("original_owner") ?? "",
    subStatus: params.get("sub_status") ?? "",
    subSource: params.get("sub_source") ?? "",
    tagPresets,
    meetingDone: boolParam(params, "meeting_done"),
    meetingNotDone: boolParam(params, "meeting_not_done"),
    siteVisitDone: boolParam(params, "site_visit_done"),
    siteVisitNotDone: boolParam(params, "site_visit_not_done"),
    projectStatus: params.get("project_status") ?? "",
    filterProjectId: params.get("filter_project_id") ?? "",
    associatedProjectsOnly: boolParam(params, "associated_projects"),
    propertyStatus: params.get("property_status") ?? "",
    propertyType: params.get("property_type") ?? "",
    propertySubType: params.get("property_sub_type") ?? "",
    bhk: params.get("bhk") ?? "",
    bhkType: params.get("bhk_type") ?? "",
    possessionFrom: params.get("possession_from") ?? "",
    possessionTo: params.get("possession_to") ?? "",
    filterCity: params.get("filter_city") ?? "",
    filterState: params.get("filter_state") ?? "",
    locality: params.get("locality") ?? "",
    country: params.get("country") ?? "",
    zone: params.get("zone") ?? "",
    latitude: params.get("latitude") ?? "",
    longitude: params.get("longitude") ?? "",
    radiusKm: params.get("radius_km") ?? "",
    countryCode: params.get("country_code") ?? "",
    altCountryCode: params.get("alt_country_code") ?? "",
    customerCountry: params.get("customer_country") ?? "",
    minBudgetFrom: params.get("min_budget_from") ?? "",
    minBudgetTo: params.get("min_budget_to") ?? "",
    maxBudgetFrom: params.get("max_budget_from") ?? "",
    maxBudgetTo: params.get("max_budget_to") ?? "",
    carpetAreaFrom: params.get("carpet_area_from") ?? "",
    carpetAreaTo: params.get("carpet_area_to") ?? "",
    builtUpAreaFrom: params.get("built_up_area_from") ?? "",
    builtUpAreaTo: params.get("built_up_area_to") ?? "",
  };
}

/** Map advanced filters to flat API query record for useLeads hook. */
export function advancedFiltersToFlatApiParams(
  filters: LeadsAdvancedFilters,
): Record<string, string> {
  const api = advancedFiltersToApiQuery(filters);
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

  if (filters.filterAssignTo) out.assignedTo = filters.filterAssignTo;
  if (filters.assignWithTeam) out.teamLeads = "true";

  return out;
}
