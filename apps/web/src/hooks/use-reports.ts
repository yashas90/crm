"use client";

import { apiDownload, apiGet } from "@/lib/apiClient";
import { SILENT_QUERY_ERROR_META } from "@/lib/query-meta";
// Web reads call metrics via /api/reports/* and /api/calls (list/summary) only.
// POST /api/calls/log is mobile-only — SIM calls are logged from the app, not the browser.
// Report endpoints require manager/admin; use isForbiddenError() in pages for 403 UX.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
export { isForbiddenError } from "@/lib/query-errors";

export type DashboardReport = {
  leads_by_status: { status: string; count: number }[];
  new_leads_count: number;
  hot_leads_count: number;
  calls_summary: {
    total: number;
    completed: number;
    missed: number;
    avg_duration: number;
  };
  calls_by_agent: {
    user_id: string;
    name: string;
    total_calls: number;
    completed_calls: number;
    avg_duration: number;
  }[];
};

export type CallsOverTimeRow = {
  date: string;
  total_calls: number;
  completed_calls: number;
  missed_calls: number;
};

export type ActivityOnLeadsOverTimeRow = {
  date: string;
  calls: number;
  meetings: number;
  notes: number;
};

export type CallsReport = {
  calls_over_time: CallsOverTimeRow[];
  disposition_breakdown: { disposition: string; count: number }[];
  direction_breakdown: { direction: string; count: number }[];
  activity_on_leads_over_time: ActivityOnLeadsOverTimeRow[];
};

export type CallsUserReportRow = {
  userId: string;
  userName: string;
  incomingAnswered: number;
  incomingMissed: number;
  incomingTotal: number;
  outgoingAnswered: number;
  outgoingNotConnected: number;
  outgoingTotal: number;
  totalTalkTimeSeconds: number;
  avgTalkTimeSeconds: number;
  minTalkTimeSeconds: number;
  maxTalkTimeSeconds: number;
  totalCalls: number;
  siteVisitsBooked: number;
  siteVisitsConducted: number;
};

export type CallsUserReportTotals = Omit<CallsUserReportRow, "userId" | "userName">;

export type CallsUserReportResponse = {
  items: CallsUserReportRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: CallsUserReportTotals;
};

export const CALLS_REPORT_PAGE_SIZES = [10, 25, 50, 100] as const;
export type CallsReportPageSize = (typeof CALLS_REPORT_PAGE_SIZES)[number];

export type LeadsOverTimeRow = {
  date: string;
  count: number;
  sourceGroup?: "Social" | "Portals" | "Others";
};

export type LeadsReport = {
  new_leads_over_time: { date: string; count: number }[];
  leads_over_time: LeadsOverTimeRow[];
  status_conversion: { from_status: string; to_status: string; count: number }[];
  avg_time_to_first_call: number;
};

export type TeamPerformanceRow = {
  user_id: string;
  name: string;
  leads_owned: number;
  calls_today: number;
  avg_duration_today: number;
  deals_won_month: number;
};

export type OverviewLeadStrip = {
  total_leads: number;
  active_leads: number;
  unassigned_leads: number;
  deleted_leads: number;
  not_interested_count: number;
  dropped_count: number;
  today_new_leads: number;
  today_calls: number;
  pending_callbacks_count: number;
  today_meetings_count: number;
  booked_count: number;
};

export type StatusBreakdownItem = {
  status: string;
  count: number;
};

export type SourceCount = {
  name: string;
  count: number;
};

export type SourceGroupReport = {
  sourceGroup: "Social" | "Portals" | "Others";
  sources: SourceCount[];
};

export type OverviewReport = {
  kpis: {
    new_leads_today: number;
    new_leads_trend: number;
    calls_today: number;
    calls_trend: number;
    deals_won_month: number;
    hot_leads: number;
    follow_ups_due_today: number;
  };
  lead_strip: OverviewLeadStrip;
  status_breakdown: StatusBreakdownItem[];
  pipeline: {
    status: string;
    count: number;
    total_value: number;
    trend_percent: number;
  }[];
  revenue: {
    won_value_month: number;
    avg_deal_size: number;
  };
  hot_leads_list: HotLeadRow[];
  leads_by_status: { status: string; count: number }[];
  calls_last_7_days: { date: string; total: number }[];
  activity_last_7_days: { date: string; leads: number; calls: number }[];
  team_performance: TeamPerformanceRow[];
  leads_from_source: SourceGroupReport[];
};

export type HotLeadRow = {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  status: string;
  score?: number | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
};

export type ProjectSummary = {
  name: string;
  leadsCount: number;
  hotLeadsCount: number;
  wonCount: number;
};

export type RecentActivity = {
  id: string;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
  leadId: string;
  leadName: string;
};

function withDateRange(query?: string) {
  return query ? `?${query}` : "";
}

export type DashboardReportParams = {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  userIds?: string[];
  withTeam?: boolean;
  status?: string;
};

export type CallsUserStatusFilter = "all" | "active" | "inactive";

export type CallsUserReportParams = DashboardReportParams & {
  userStatus?: CallsUserStatusFilter;
  userName?: string;
  userIds?: string[];
  withTeam?: boolean;
  source?: string;
  subSource?: string;
  projectName?: string;
  projectStatus?: "active" | "inactive";
  campaignName?: string;
  page?: number;
  pageSize?: number;
};

export function buildCallsUserReportQuery(
  params: CallsUserReportParams,
  options?: { includePagination?: boolean },
) {
  const userStatus = params.userStatus ?? "all";
  const userName = params.userName?.trim() ?? "";
  const search = new URLSearchParams();
  if (params.dateFrom) search.set("date_from", params.dateFrom);
  if (params.dateTo) search.set("date_to", params.dateTo);
  if (params.userIds?.length) {
    search.set("user_ids", params.userIds.join(","));
  } else if (params.userId) {
    search.set("user_id", params.userId);
  }
  if (params.status) search.set("status", params.status);
  if (userStatus !== "all") search.set("user_status", userStatus);
  if (userName) search.set("user_name", userName);
  if (params.source) search.set("source", params.source);
  if (params.subSource) search.set("sub_source", params.subSource);
  if (params.projectName) search.set("project_name", params.projectName);
  if (params.projectStatus) search.set("project_status", params.projectStatus);
  if (params.campaignName) search.set("campaign_name", params.campaignName);
  if (params.withTeam) search.set("with_team", "true");
  if (options?.includePagination !== false) {
    search.set("page", String(params.page ?? 1));
    search.set("page_size", String(params.pageSize ?? 50));
  }
  search.set("group_by", "user");
  return { query: search.toString(), userStatus, userName };
}

export async function downloadCallsUserReport(params: CallsUserReportParams) {
  const { query } = buildCallsUserReportQuery(params, { includePagination: false });
  const date = new Date().toISOString().slice(0, 10);
  await apiDownload(`/api/reports/calls/export?${query}`, `calls-report-${date}.csv`);
}

export async function downloadSourcesReportCsv(params: DashboardReportParams) {
  const query = buildReportQuery(params);
  const date = new Date().toISOString().slice(0, 10);
  await apiDownload(`/api/reports/sources/export?${query}`, `lead-sources-${date}.csv`);
}

export async function downloadCallsAnalyticsReport(
  params: DashboardReportParams & { userIds?: string[] },
) {
  const query = buildReportQuery(params);
  const date = new Date().toISOString().slice(0, 10);
  await apiDownload(`/api/reports/calls/analytics/export?${query}`, `calls-analytics-${date}.csv`);
}

function buildReportQuery(params: DashboardReportParams) {
  const search = new URLSearchParams();
  if (params.dateFrom) search.set("date_from", params.dateFrom);
  if (params.dateTo) search.set("date_to", params.dateTo);
  if (params.userIds?.length) {
    search.set("user_ids", params.userIds.join(","));
  } else if (params.userId) {
    search.set("user_id", params.userId);
  }
  if (params.withTeam) search.set("with_team", "true");
  if (params.status) search.set("status", params.status);
  return search.toString();
}

export function useDashboardReport(dateFrom?: string, dateTo?: string, userId?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  if (userId) params.set("user_id", userId);

  return useQuery({
    queryKey: ["reports", "dashboard", dateFrom, dateTo, userId],
    queryFn: () =>
      apiGet<DashboardReport>(`/api/reports/dashboard${withDateRange(params.toString())}`),
    meta: SILENT_QUERY_ERROR_META,
  });
}

export function useLeadsReport(params: DashboardReportParams, options?: { enabled?: boolean }) {
  const query = buildReportQuery(params);

  return useQuery({
    queryKey: ["reports", "leads", params.dateFrom, params.dateTo, params.userId, params.status],
    queryFn: () => apiGet<LeadsReport>(`/api/reports/leads${withDateRange(query)}`),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    meta: SILENT_QUERY_ERROR_META,
  });
}

export function useCallsReport(params: DashboardReportParams, options?: { enabled?: boolean }) {
  const query = buildReportQuery(params);

  return useQuery({
    queryKey: [
      "reports",
      "calls",
      params.dateFrom,
      params.dateTo,
      params.userId,
      params.userIds,
      params.withTeam ?? false,
      params.status,
    ],
    queryFn: () => apiGet<CallsReport>(`/api/reports/calls${withDateRange(query)}`),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    meta: SILENT_QUERY_ERROR_META,
  });
}

export function useCallsUserReport(params: CallsUserReportParams, options?: { enabled?: boolean }) {
  const { query, userStatus, userName } = buildCallsUserReportQuery(params);

  return useQuery({
    queryKey: [
      "reports",
      "calls",
      "per-user",
      params.dateFrom,
      params.dateTo,
      params.userId,
      params.userIds,
      params.withTeam ?? false,
      params.status,
      userStatus,
      userName,
      params.source,
      params.subSource,
      params.projectName,
      params.projectStatus,
      params.campaignName,
      params.page,
      params.pageSize,
    ],
    queryFn: () => apiGet<CallsUserReportResponse>(`/api/reports/calls${withDateRange(query)}`),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useOverviewReport(params: DashboardReportParams & { enabled?: boolean } = {}) {
  const { enabled, ...filters } = params;
  const query = buildReportQuery(filters);

  return useQuery({
    queryKey: [
      "reports",
      "overview",
      filters.dateFrom,
      filters.dateTo,
      filters.userId,
      filters.status,
    ],
    queryFn: () => apiGet<OverviewReport>(`/api/reports/overview${withDateRange(query)}`),
    enabled: enabled ?? true,
    placeholderData: keepPreviousData,
    meta: { ...SILENT_QUERY_ERROR_META, errorContext: "overview" },
  });
}

/** Memoized lead KPI strip counts from /api/reports/overview. */
export function useOverviewKpiStrip(params: DashboardReportParams & { enabled?: boolean } = {}) {
  const overview = useOverviewReport(params);

  const strip = useMemo(() => overview.data?.lead_strip ?? null, [overview.data?.lead_strip]);

  return {
    ...overview,
    strip,
  };
}

export type SourcesReport = {
  leads_from_source: SourceGroupReport[];
};

/** Lead counts grouped by source bucket from /api/reports/sources. */
export function useSourceReport(params: DashboardReportParams & { enabled?: boolean } = {}) {
  const { enabled, ...filters } = params;
  const query = buildReportQuery(filters);

  return useQuery({
    queryKey: [
      "reports",
      "sources",
      filters.dateFrom,
      filters.dateTo,
      filters.userId,
      filters.status,
    ],
    queryFn: () => apiGet<SourcesReport>(`/api/reports/sources${withDateRange(query)}`),
    enabled: enabled ?? true,
    placeholderData: keepPreviousData,
    meta: SILENT_QUERY_ERROR_META,
  });
}

export function useRecentActivities() {
  return useQuery({
    queryKey: ["activities", "recent"],
    queryFn: () => apiGet<RecentActivity[]>("/api/leads/activities/recent"),
    meta: SILENT_QUERY_ERROR_META,
  });
}

export function useProjectsReport() {
  return useQuery({
    queryKey: ["reports", "projects"],
    queryFn: () => apiGet<{ projects: ProjectSummary[] }>("/api/reports/projects"),
  });
}
