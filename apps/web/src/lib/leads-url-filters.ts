import { normalizeLeadSourceValue } from "@/lib/lead-sources";
import {
  type LeadsAdvancedFilters,
  appendAdvancedFiltersToParams,
  countActiveAdvancedFilters,
  defaultLeadsAdvancedFilters,
  parseAdvancedFiltersFromParams,
} from "@/lib/leads-advanced-filters";
import { advancedFiltersToFlatApiParams } from "@/lib/leads-advanced-filters";
import { type LeadsDatePreset, inferDatePresetFromRange } from "@/lib/leads-date-filters";
import {
  type LeadsScope,
  scopeFromSearchParams,
  scopeToQueryParams,
  scopeUsesStageFilters,
} from "@/lib/leads-scope";
import {
  type LeadsStage,
  defaultLeadsStage,
  stageFromUrlFilters,
  stageToQueryParams,
  stageToUrlParams,
} from "@/lib/leads-stage";
import { toApiRange } from "@/lib/report-filters";

export type LeadsUrlFilters = LeadsAdvancedFilters & {
  search: string;
  status: string;
  temperature: string;
  source: string;
  adLeadsOnly: boolean;
  tags: string;
  myLeadsOnly: boolean;
  unassigned: boolean;
  activeOnly: boolean;
  followUpFilter: "" | "due_today" | "overdue" | "upcoming";
  datePreset: LeadsDatePreset;
  dateFrom?: string;
  dateTo?: string;
  importBatchId: string;
  importBatchLabel: string;
};

export const defaultLeadsUrlFilters = (): LeadsUrlFilters => ({
  ...defaultLeadsAdvancedFilters(),
  search: "",
  status: "",
  temperature: "",
  source: "",
  adLeadsOnly: false,
  tags: "",
  myLeadsOnly: false,
  unassigned: false,
  activeOnly: false,
  followUpFilter: "",
  datePreset: "all",
  importBatchId: "",
  importBatchLabel: "",
});

/** Filters applied after CSV import — show the upload batch, no source/date filters. */
export function postImportLeadsFilters(input: {
  batchId: string;
  fileName?: string | null;
}): LeadsUrlFilters {
  return {
    ...defaultLeadsUrlFilters(),
    importBatchId: input.batchId,
    importBatchLabel:
      input.fileName?.trim() ||
      `Upload ${new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
  };
}

/** Normalize comma-separated tag filter for URL/API (trim, dedupe order preserved). */
export function normalizeTagsFilter(raw: string): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags.join(",");
}

export function tagsFilterToApiParam(tags: string): string | undefined {
  const normalized = normalizeTagsFilter(tags);
  return normalized || undefined;
}

export function parseLeadsSearchParams(params: URLSearchParams): LeadsUrlFilters {
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;

  const dateFrom = from;
  const dateTo = to ?? from;
  const scopeParam = params.get("scope");

  return {
    ...parseAdvancedFiltersFromParams(params),
    search: params.get("search") ?? "",
    status: params.get("status") ?? "",
    temperature: params.get("temperature") ?? "",
    source: params.get("source") ? normalizeLeadSourceValue(params.get("source")!) : "",
    adLeadsOnly: params.get("ad_leads") === "true",
    tags: normalizeTagsFilter(params.get("tags") ?? ""),
    myLeadsOnly: scopeParam === "my" || params.get("my_leads") === "true",
    unassigned: scopeParam === "unassigned" || params.get("unassigned") === "true",
    activeOnly: params.get("active") === "true",
    followUpFilter: (params.get("follow_up") as LeadsUrlFilters["followUpFilter"]) || "",
    datePreset: inferDatePresetFromRange(dateFrom, dateTo),
    dateFrom,
    dateTo,
    importBatchId: params.get("import_batch") ?? "",
    importBatchLabel: params.get("import_batch_label") ?? "",
  };
}

export function parseLeadsPageUrl(params: URLSearchParams) {
  const filters = parseLeadsSearchParams(params);
  return {
    filters,
    scope: scopeFromSearchParams(params, filters),
    stage: stageFromUrlFilters(filters),
  };
}

/** Serialize filters + scope + stage into a query string (no leading `?`). */
export function buildLeadsSearchParams(
  filters: LeadsUrlFilters,
  options?: { scope?: LeadsScope; stage?: LeadsStage },
): string {
  const params = new URLSearchParams();
  const scope = options?.scope ?? "all";
  const stage = options?.stage ?? stageFromUrlFilters(filters);

  if (filters.search.trim()) params.set("search", filters.search.trim());

  if (scope !== "all") {
    params.set("scope", scope);
  }

  if (scopeUsesStageFilters(scope)) {
    const stageParams = stageToUrlParams(stage);
    if (stageParams.status) params.set("status", stageParams.status);
    if (stageParams.active) params.set("active", "true");
    if (stageParams.followUp) params.set("follow_up", stageParams.followUp);
  }

  if (filters.adLeadsOnly) {
    params.set("ad_leads", "true");
  } else if (filters.source.trim()) {
    params.set("source", normalizeLeadSourceValue(filters.source));
  }

  if (filters.temperature) params.set("temperature", filters.temperature);

  const tags = tagsFilterToApiParam(filters.tags);
  if (tags) params.set("tags", tags);

  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo && filters.dateTo !== filters.dateFrom) {
    params.set("to", filters.dateTo);
  } else if (filters.dateFrom && filters.dateTo === filters.dateFrom) {
    params.set("to", filters.dateTo);
  }

  if (filters.importBatchId) {
    params.set("import_batch", filters.importBatchId);
    if (filters.importBatchLabel.trim()) {
      params.set("import_batch_label", filters.importBatchLabel.trim());
    }
  }

  appendAdvancedFiltersToParams(params, filters);

  return params.toString();
}

export function countAdvancedLeadsFilters(filters: LeadsUrlFilters) {
  let count = 0;
  if (filters.status) count += 1;
  if (filters.source.trim() || filters.adLeadsOnly) count += 1;
  if (filters.temperature) count += 1;
  if (filters.followUpFilter) count += 1;
  if (tagsFilterToApiParam(filters.tags)) count += 1;
  if (filters.importBatchId) count += 1;
  count += countActiveAdvancedFilters(filters);
  return count;
}

function resolveScopeAssignment(filters: LeadsUrlFilters, scope: LeadsScope, userId?: string) {
  const scopeParams = scopeToQueryParams(scope, userId);

  if (scope !== "all") {
    return {
      assignedTo: scopeParams.assignedTo,
      unassigned: scopeParams.unassigned,
      deletedOnly: scopeParams.deletedOnly,
      teamLeads: scopeParams.teamLeads,
      duplicatesOnly: scopeParams.duplicatesOnly,
      excludeDuplicates: scopeParams.excludeDuplicates,
      reEnquiredOnly: scopeParams.reEnquiredOnly,
      naLeadsOnly: scopeParams.naLeadsOnly,
    };
  }

  return {
    assignedTo: filters.unassigned ? undefined : filters.myLeadsOnly ? userId : undefined,
    unassigned: filters.unassigned ? ("true" as const) : undefined,
    deletedOnly: scopeParams.deletedOnly,
    teamLeads: undefined,
    duplicatesOnly: scopeParams.duplicatesOnly,
    excludeDuplicates: scopeParams.excludeDuplicates ?? "true",
    reEnquiredOnly: scopeParams.reEnquiredOnly,
    naLeadsOnly: undefined,
  };
}

/** Shared search/date/temperature/source filters — no scope assignment (for scope tab counts). */
export function leadsSharedFiltersToQuery(filters: LeadsUrlFilters) {
  const dateRange =
    filters.dateFrom && filters.dateTo
      ? toApiRange(filters.dateFrom, filters.dateTo)
      : { dateFrom: undefined, dateTo: undefined };

  return {
    search: filters.search || undefined,
    temperature: filters.temperature || undefined,
    source: filters.adLeadsOnly
      ? undefined
      : filters.source
        ? normalizeLeadSourceValue(filters.source)
        : undefined,
    adLeads: filters.adLeadsOnly ? ("true" as const) : undefined,
    tags: tagsFilterToApiParam(filters.tags),
    importBatchId: filters.importBatchId || undefined,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
  };
}

/** Scope + search/temperature/source/date — used for stage count aggregation. */
export function leadsBaseFiltersToQuery(
  filters: LeadsUrlFilters,
  options?: { userId?: string; scope?: LeadsScope },
) {
  const dateRange =
    filters.dateFrom && filters.dateTo
      ? toApiRange(filters.dateFrom, filters.dateTo)
      : { dateFrom: undefined, dateTo: undefined };

  const scope = options?.scope ?? "all";
  const assignment = resolveScopeAssignment(filters, scope, options?.userId);

  return {
    search: filters.search || undefined,
    temperature: filters.temperature || undefined,
    source: filters.adLeadsOnly
      ? undefined
      : filters.source
        ? normalizeLeadSourceValue(filters.source)
        : undefined,
    adLeads: filters.adLeadsOnly ? ("true" as const) : undefined,
    tags: tagsFilterToApiParam(filters.tags),
    assignedTo: assignment.assignedTo,
    unassigned: assignment.unassigned,
    deletedOnly: assignment.deletedOnly,
    teamLeads: assignment.teamLeads,
    duplicatesOnly: assignment.duplicatesOnly,
    excludeDuplicates: assignment.excludeDuplicates,
    reEnquiredOnly: assignment.reEnquiredOnly,
    naLeadsOnly: assignment.naLeadsOnly,
    importBatchId: filters.importBatchId || undefined,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
  };
}

export const LEADS_PAGE_SIZES = [10, 25, 50, 100] as const;
export type LeadsPageSize = (typeof LEADS_PAGE_SIZES)[number];
export const DEFAULT_LEADS_PAGE_SIZE: LeadsPageSize = 25;

export function leadsFiltersToQuery(
  filters: LeadsUrlFilters,
  options?: {
    userId?: string;
    scope?: LeadsScope;
    stage?: LeadsStage;
    page?: number;
    pageSize?: LeadsPageSize;
  },
) {
  const scope = options?.scope ?? "all";
  const stage = options?.stage ?? defaultLeadsStage();
  const stageParams = scopeUsesStageFilters(scope) ? stageToQueryParams(stage) : {};

  return {
    ...leadsBaseFiltersToQuery(filters, options),
    status: stageParams.status,
    activeOnly: stageParams.activeOnly,
    followUpDueBefore: stageParams.followUpDueBefore,
    followUpDueAfter: stageParams.followUpDueAfter,
    orderByFollowUp: stageParams.orderByFollowUp,
    page: String(options?.page ?? 1),
    pageSize: String(options?.pageSize ?? DEFAULT_LEADS_PAGE_SIZE),
    ...advancedFiltersToFlatApiParams(filters),
  };
}
