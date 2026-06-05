"use client";

import { apiGet } from "@/lib/apiClient";
// Web reads call metrics via /api/reports/* and /api/calls (list/summary) only.
// POST /api/calls/log is mobile-only — SIM calls are logged from the app, not the browser.
// Report endpoints require manager/admin; use isForbiddenError() in pages for 403 UX.
import { useQuery } from "@tanstack/react-query";
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

export type CallsReport = {
  calls_over_time: {
    date: string;
    total_calls: number;
    completed_calls: number;
    missed_calls: number;
  }[];
  disposition_breakdown: { disposition: string; count: number }[];
  direction_breakdown: { direction: string; count: number }[];
};

export type LeadsReport = {
  new_leads_over_time: { date: string; count: number }[];
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
};

export type HotLeadRow = {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  status: string;
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

export function useDashboardReport(dateFrom?: string, dateTo?: string, userId?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  if (userId) params.set("user_id", userId);

  return useQuery({
    queryKey: ["reports", "dashboard", dateFrom, dateTo, userId],
    queryFn: () =>
      apiGet<DashboardReport>(`/api/reports/dashboard${withDateRange(params.toString())}`),
  });
}

export function useLeadsReport(dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  return useQuery({
    queryKey: ["reports", "leads", dateFrom, dateTo],
    queryFn: () => apiGet<LeadsReport>(`/api/reports/leads${withDateRange(params.toString())}`),
  });
}

export function useCallsReport(dateFrom?: string, dateTo?: string, userId?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  if (userId) params.set("user_id", userId);

  return useQuery({
    queryKey: ["reports", "calls", dateFrom, dateTo, userId],
    queryFn: () => apiGet<CallsReport>(`/api/reports/calls${withDateRange(params.toString())}`),
  });
}

export function useOverviewReport(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["reports", "overview"],
    queryFn: () => apiGet<OverviewReport>("/api/reports/overview"),
    enabled: options?.enabled ?? true,
  });
}

export function useRecentActivities() {
  return useQuery({
    queryKey: ["activities", "recent"],
    queryFn: () => apiGet<RecentActivity[]>("/api/leads/activities/recent"),
  });
}

export function useProjectsReport() {
  return useQuery({
    queryKey: ["reports", "projects"],
    queryFn: () => apiGet<{ projects: ProjectSummary[] }>("/api/reports/projects"),
  });
}
