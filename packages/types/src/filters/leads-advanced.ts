/** Advanced lead list filters (web + mobile + API query mapping). */
export type LeadsAdvancedFilters = {
  assignWithHistory: boolean;
  assignWithTeam: boolean;
  filterAssignTo: string;
  assignedFrom: string;
  assignedBy: string;
  originalOwner: string;
  subStatus: string;
  subSource: string;
  tagPresets: string[];
  meetingDone: boolean;
  meetingNotDone: boolean;
  siteVisitDone: boolean;
  siteVisitNotDone: boolean;
  projectStatus: string;
  filterProjectId: string;
  associatedProjectsOnly: boolean;
  propertyStatus: string;
  propertyType: string;
  propertySubType: string;
  bhk: string;
  bhkType: string;
  possessionFrom: string;
  possessionTo: string;
  filterCity: string;
  filterState: string;
  locality: string;
  country: string;
  zone: string;
  latitude: string;
  longitude: string;
  radiusKm: string;
  countryCode: string;
  altCountryCode: string;
  customerCountry: string;
  minBudgetFrom: string;
  minBudgetTo: string;
  maxBudgetFrom: string;
  maxBudgetTo: string;
  carpetAreaFrom: string;
  carpetAreaTo: string;
  builtUpAreaFrom: string;
  builtUpAreaTo: string;
};

export const TAG_PRESET_OPTIONS = [
  { id: "about_to_convert", label: "About to convert" },
  { id: "cold", label: "Cold" },
  { id: "escalated", label: "Escalated" },
  { id: "highlighted", label: "Highlighted" },
  { id: "hot", label: "Hot" },
  { id: "warm", label: "Warm" },
] as const;

export type TagPresetId = (typeof TAG_PRESET_OPTIONS)[number]["id"];

export function defaultLeadsAdvancedFilters(): LeadsAdvancedFilters {
  return {
    assignWithHistory: false,
    assignWithTeam: false,
    filterAssignTo: "",
    assignedFrom: "",
    assignedBy: "",
    originalOwner: "",
    subStatus: "",
    subSource: "",
    tagPresets: [],
    meetingDone: false,
    meetingNotDone: false,
    siteVisitDone: false,
    siteVisitNotDone: false,
    projectStatus: "",
    filterProjectId: "",
    associatedProjectsOnly: false,
    propertyStatus: "",
    propertyType: "",
    propertySubType: "",
    bhk: "",
    bhkType: "",
    possessionFrom: "",
    possessionTo: "",
    filterCity: "",
    filterState: "",
    locality: "",
    country: "",
    zone: "",
    latitude: "",
    longitude: "",
    radiusKm: "",
    countryCode: "",
    altCountryCode: "",
    customerCountry: "",
    minBudgetFrom: "",
    minBudgetTo: "",
    maxBudgetFrom: "",
    maxBudgetTo: "",
    carpetAreaFrom: "",
    carpetAreaTo: "",
    builtUpAreaFrom: "",
    builtUpAreaTo: "",
  };
}

/** Maps preset chips to API `tagPresets` query param. */
export function tagPresetsToApiParam(presets: string[]): string | undefined {
  const normalized = presets.map((p) => p.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join(",") : undefined;
}

export type LeadListAdvancedApiQuery = {
  assignWithHistory?: boolean;
  assignedFrom?: string;
  assignedBy?: string;
  originalOwner?: string;
  subStatus?: string;
  subSource?: string;
  tagPresets?: string[];
  meetingDone?: boolean;
  meetingNotDone?: boolean;
  siteVisitDone?: boolean;
  siteVisitNotDone?: boolean;
  projectStatus?: string;
  hasProject?: boolean;
  possessionFrom?: string;
  possessionTo?: string;
  city?: string;
  state?: string;
  locality?: string;
  country?: string;
  zone?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  countryCode?: string;
  altCountryCode?: string;
  customerCountry?: string;
  propertyStatus?: string;
  propertyType?: string;
  propertySubType?: string;
  bhk?: string;
  bhkType?: string;
  minBudgetFrom?: number;
  minBudgetTo?: number;
  maxBudgetFrom?: number;
  maxBudgetTo?: number;
  carpetAreaFrom?: number;
  carpetAreaTo?: number;
  builtUpAreaFrom?: number;
  builtUpAreaTo?: number;
};

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function advancedFiltersToApiQuery(filters: LeadsAdvancedFilters): LeadListAdvancedApiQuery {
  const tagPresets = filters.tagPresets.length > 0 ? filters.tagPresets : undefined;
  const lat = parseOptionalNumber(filters.latitude);
  const lng = parseOptionalNumber(filters.longitude);
  const radius = parseOptionalNumber(filters.radiusKm);

  return {
    assignWithHistory: filters.assignWithHistory || undefined,
    assignedFrom: filters.assignedFrom || undefined,
    assignedBy: filters.assignedBy || undefined,
    originalOwner: filters.originalOwner || undefined,
    subStatus: filters.subStatus || undefined,
    subSource: filters.subSource || undefined,
    tagPresets,
    meetingDone: filters.meetingDone || undefined,
    meetingNotDone: filters.meetingNotDone || undefined,
    siteVisitDone: filters.siteVisitDone || undefined,
    siteVisitNotDone: filters.siteVisitNotDone || undefined,
    projectStatus: filters.projectStatus || undefined,
    hasProject: filters.associatedProjectsOnly || undefined,
    possessionFrom: filters.possessionFrom || undefined,
    possessionTo: filters.possessionTo || undefined,
    city: filters.filterCity || undefined,
    state: filters.filterState || undefined,
    locality: filters.locality || undefined,
    country: filters.country || undefined,
    zone: filters.zone || undefined,
    latitude: lat,
    longitude: lng,
    radiusKm: lat !== undefined && lng !== undefined && radius !== undefined ? radius : undefined,
    countryCode: filters.countryCode || undefined,
    altCountryCode: filters.altCountryCode || undefined,
    customerCountry: filters.customerCountry || undefined,
    propertyStatus: filters.propertyStatus || undefined,
    propertyType: filters.propertyType || undefined,
    propertySubType: filters.propertySubType || undefined,
    bhk: filters.bhk || undefined,
    bhkType: filters.bhkType || undefined,
    minBudgetFrom: parseOptionalNumber(filters.minBudgetFrom),
    minBudgetTo: parseOptionalNumber(filters.minBudgetTo),
    maxBudgetFrom: parseOptionalNumber(filters.maxBudgetFrom),
    maxBudgetTo: parseOptionalNumber(filters.maxBudgetTo),
    carpetAreaFrom: parseOptionalNumber(filters.carpetAreaFrom),
    carpetAreaTo: parseOptionalNumber(filters.carpetAreaTo),
    builtUpAreaFrom: parseOptionalNumber(filters.builtUpAreaFrom),
    builtUpAreaTo: parseOptionalNumber(filters.builtUpAreaTo),
  };
}

export function countActiveAdvancedFilters(filters: LeadsAdvancedFilters): number {
  let count = 0;
  if (filters.filterAssignTo) count += 1;
  if (filters.assignWithHistory) count += 1;
  if (filters.assignWithTeam) count += 1;
  if (filters.assignedFrom) count += 1;
  if (filters.assignedBy) count += 1;
  if (filters.originalOwner) count += 1;
  if (filters.subStatus) count += 1;
  if (filters.subSource) count += 1;
  if (filters.tagPresets.length > 0) count += 1;
  if (
    filters.meetingDone ||
    filters.meetingNotDone ||
    filters.siteVisitDone ||
    filters.siteVisitNotDone
  ) {
    count += 1;
  }
  if (filters.projectStatus || filters.filterProjectId || filters.associatedProjectsOnly)
    count += 1;
  if (
    filters.propertyStatus ||
    filters.propertyType ||
    filters.propertySubType ||
    filters.bhk ||
    filters.bhkType ||
    filters.possessionFrom ||
    filters.possessionTo
  ) {
    count += 1;
  }
  if (
    filters.filterCity ||
    filters.filterState ||
    filters.locality ||
    filters.country ||
    filters.zone ||
    filters.latitude ||
    filters.longitude ||
    filters.radiusKm ||
    filters.countryCode ||
    filters.altCountryCode ||
    filters.customerCountry
  ) {
    count += 1;
  }
  if (
    filters.minBudgetFrom ||
    filters.minBudgetTo ||
    filters.maxBudgetFrom ||
    filters.maxBudgetTo ||
    filters.carpetAreaFrom ||
    filters.carpetAreaTo ||
    filters.builtUpAreaFrom ||
    filters.builtUpAreaTo
  ) {
    count += 1;
  }
  return count;
}
