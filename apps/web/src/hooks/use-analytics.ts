"use client";

import { apiGet } from "@/lib/apiClient";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const ANALYTICS_STALE_TIME_MS = 5 * 60 * 1000;

export type AnalyticsKpi = {
  value: number;
  previousValue: number;
  changePercent: number | null;
};

export type AnalyticsOverview = {
  period: {
    dateFrom: string;
    dateTo: string;
    previousFrom: string;
    previousTo: string;
  };
  kpis: {
    totalLeads: AnalyticsKpi;
    leadsContacted: AnalyticsKpi;
    siteVisitsScheduled: AnalyticsKpi;
    siteVisitsCompleted: AnalyticsKpi;
    leadsWon: AnalyticsKpi;
    conversionRate: AnalyticsKpi;
    totalCalls: AnalyticsKpi;
    avgResponseTimeHours: AnalyticsKpi;
    bookingsThisMonth: AnalyticsKpi;
  };
  charts: {
    leadsOverTime: { date: string; count: number }[];
    leadFunnel: { stage: string; count: number }[];
    callsByOutcome: { outcome: string; count: number }[];
    leadSources: { source: string; count: number }[];
  };
  leaderboard: {
    agentId: string;
    agentName: string;
    leadsAssigned: number;
    callsMade: number;
    answeredPercent: number;
    visitsDone: number;
    won: number;
    conversionPercent: number;
  }[];
  health: {
    coldLeads: { count: number; preview: AnalyticsLeadPreview[] };
    overdueFollowUps: { count: number; preview: AnalyticsLeadPreview[] };
    unassignedLeads: { count: number; leadIds: string[]; preview: AnalyticsLeadPreview[] };
    stalePipeline: { count: number; preview: AnalyticsLeadPreview[] };
  };
};

export type AnalyticsLeadPreview = {
  id: string;
  name: string;
  phone: string | null;
  agentName: string | null;
  leadStatus: string;
  daysSinceContact?: number;
  daysOverdue?: number;
  daysInStage?: number;
};

export function useAnalyticsOverview(dateFrom: string, dateTo: string, enabled = true) {
  const params = new URLSearchParams({ dateFrom, dateTo });

  return useQuery({
    queryKey: ["analytics", "overview", dateFrom, dateTo],
    queryFn: () => apiGet<AnalyticsOverview>(`/api/analytics/overview?${params.toString()}`),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME_MS,
  });
}

export type BookedUnitRow = {
  id: string;
  bookingRef: string;
  generatedAt: string;
  unitId: string;
  unitNumber: string;
  floor: number;
  bedrooms: number;
  status: string;
  projectId: string;
  projectName: string;
  leadName: string;
};

export function useBookedUnits(dateFrom: string, dateTo: string, enabled = true) {
  const params = new URLSearchParams({ dateFrom, dateTo });
  return useQuery({
    queryKey: ["analytics", "booked-units", dateFrom, dateTo],
    queryFn: () =>
      apiGet<{ items: BookedUnitRow[] }>(`/api/analytics/booked-units?${params.toString()}`),
    enabled,
    staleTime: ANALYTICS_STALE_TIME_MS,
  });
}
