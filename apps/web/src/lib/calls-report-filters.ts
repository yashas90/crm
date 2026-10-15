import { LEAD_SOURCE_VALUES } from "@/lib/lead-sources";
import type { DateRangePreset } from "@/lib/report-filters";
import { addDaysToDateKey, getIstDateKey, istWallClockToDate } from "@propninja/types/ist";

export const CALLS_LEAD_SOURCE_OPTIONS = LEAD_SOURCE_VALUES;

export type CallsReportDatePreset = Extract<
  DateRangePreset,
  "today" | "yesterday" | "last7" | "last30" | "custom"
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
    datePreset: "today",
  };
}

/** Calendar dates for the call report are IST days, including the preset shortcuts. */
export function resolveCallsReportDates(filters: CallsReportFilterState) {
  if (filters.datePreset === "custom" && filters.dateFrom && filters.dateTo) {
    return { from: filters.dateFrom, to: filters.dateTo };
  }

  const today = getIstDateKey();
  if (filters.datePreset === "today") return { from: today, to: today };
  if (filters.datePreset === "yesterday") {
    const day = addDaysToDateKey(today, -1);
    return { from: day, to: day };
  }
  if (filters.datePreset === "last30") {
    return { from: addDaysToDateKey(today, -30), to: today };
  }
  return { from: addDaysToDateKey(today, -7), to: today };
}

export function callsReportFiltersToApiRange(filters: CallsReportFilterState) {
  const { from, to } = resolveCallsReportDates(filters);
  const dateFrom = istWallClockToDate(from, 0, 0);
  const dateTo = new Date(istWallClockToDate(addDaysToDateKey(to, 1), 0, 0).getTime() - 1);
  return {
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  };
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
  if (filters.datePreset !== "today") count += 1;
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
