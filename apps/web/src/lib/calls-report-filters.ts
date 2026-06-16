import { type DateRangePreset, resolveReportFilters, toApiRange } from "@/lib/report-filters";

import { LEAD_SOURCE_VALUES } from "@/lib/lead-sources";

export const CALLS_LEAD_SOURCE_OPTIONS = LEAD_SOURCE_VALUES;

export type CallsReportDatePreset = Extract<
  DateRangePreset,
  "today" | "yesterday" | "last7" | "custom"
>;

export type CallsReportFilterState = {
  userIds: string[];
  withTeam: boolean;
  source: string;
  subSource: string;
  projectStatus: "" | "active" | "inactive";
  projectName: string;
  campaignName: string;
  datePreset: CallsReportDatePreset;
  dateFrom?: string;
  dateTo?: string;
};

export function defaultCallsReportFilters(): CallsReportFilterState {
  return {
    userIds: [],
    withTeam: false,
    source: "",
    subSource: "",
    projectStatus: "",
    projectName: "",
    campaignName: "",
    datePreset: "last7",
  };
}

export function resolveCallsReportDates(filters: CallsReportFilterState) {
  return resolveReportFilters({
    dateRange: {
      preset: filters.datePreset,
      from: filters.dateFrom,
      to: filters.dateTo,
    },
  });
}

export function callsReportFiltersToApiRange(filters: CallsReportFilterState) {
  const { from, to } = resolveCallsReportDates(filters);
  return toApiRange(from, to);
}

export function countActiveCallsReportFilters(filters: CallsReportFilterState): number {
  let count = 0;
  if (filters.userIds.length > 0) count += 1;
  if (filters.withTeam) count += 1;
  if (filters.source) count += 1;
  if (filters.subSource) count += 1;
  if (filters.projectStatus) count += 1;
  if (filters.projectName) count += 1;
  if (filters.campaignName) count += 1;
  if (filters.datePreset !== "last7") count += 1;
  return count;
}

/** Shared lead/user filter fields for calls report API requests. */
export function callsReportFiltersToQueryParams(filters: CallsReportFilterState) {
  return {
    userIds: filters.userIds.length > 0 ? filters.userIds : undefined,
    withTeam: filters.withTeam || undefined,
    source: filters.source || undefined,
    subSource: filters.subSource || undefined,
    projectName: filters.projectName || undefined,
    projectStatus: filters.projectStatus || undefined,
    campaignName: filters.campaignName || undefined,
  };
}
