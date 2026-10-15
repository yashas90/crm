"use client";

import { apiGet } from "@/lib/apiClient";
import { SILENT_QUERY_ERROR_META } from "@/lib/query-meta";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const ADMIN_DASHBOARD_PERIODS = ["today", "7d", "30d", "quarter"] as const;

export type AdminDashboardPeriod = (typeof ADMIN_DASHBOARD_PERIODS)[number];

export type RevenueCard = {
  amount: number;
  changePercent: number;
  sparkline: number[];
};

export type AdminOverview = {
  period: AdminDashboardPeriod;
  label: string;
  scope: "org" | "team";
  source: string | null;
  range: { from: string; to: string };
  revenue: {
    total: RevenueCard;
    today: RevenueCard;
    last7Days: RevenueCard;
    last30Days: RevenueCard;
    lastQuarter: RevenueCard;
  };
  leadsReceived: {
    total: number;
    active: number;
    lost: number;
    byStatus: { status: string; label: string; count: number }[];
  };
  sources: { source: string; count: number; percent: number }[];
  sourceOptions: string[];
  funnel: { key: string; label: string; count: number; percent: number }[];
  topClosers: { userId: string; name: string; netRevenue: number; deals: number }[];
  drivers: {
    newLeads: { count: number; previous: number; changePercent: number };
    siteVisits: { count: number; previous: number; changePercent: number };
    closed: { count: number; previous: number; changePercent: number };
    pending: { count: number; previous: number; changePercent: number };
  };
  reminders: {
    id: string;
    kind: "site_visit" | "follow_up";
    title: string;
    subtitle: string;
    at: string;
  }[];
  agentTalktime: {
    userId: string;
    name: string;
    totalCalls: number;
    connected: number;
    totalDurationSeconds: number;
    incoming: number;
    incomingAnswered: number;
    incomingMissed: number;
    incomingDurationSeconds: number;
    outgoing: number;
    outgoingDurationSeconds: number;
    outgoingAnswered: number;
    outgoingNotAnswered: number;
  }[];
};

export function useAdminOverview(period: AdminDashboardPeriod, source: string, enabled: boolean) {
  const params = new URLSearchParams({ period });
  if (source) params.set("source", source);

  return useQuery({
    queryKey: ["dashboard", "admin-overview", period, source],
    queryFn: () => apiGet<AdminOverview>(`/api/dashboard/admin-overview?${params.toString()}`),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    meta: SILENT_QUERY_ERROR_META,
  });
}
