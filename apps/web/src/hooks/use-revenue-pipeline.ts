"use client";

import { apiDownload, apiGet } from "@/lib/apiClient";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type RevenuePipelineProjectRow = {
  projectId: string;
  projectName: string;
  availableUnits: number;
  reservedUnits: number;
  bookedUnits: number;
  soldUnits: number;
  totalListedValue: number;
  totalBookedValue: number;
  leads: number;
};

export type RevenuePipelineStageRow = {
  stage: string;
  leadCount: number;
  estimatedValue: number;
};

export type RevenuePipelineReport = {
  totalPipelineValue: number;
  confirmedRevenue: number;
  projectedRevenue: number;
  byProject: RevenuePipelineProjectRow[];
  byStage: RevenuePipelineStageRow[];
  wonThisPeriod: number;
  lostThisPeriod: number;
  conversionRate: number | null;
};

export function useRevenuePipelineReport(params: {
  dateFrom: string;
  dateTo: string;
  projectId?: string;
  enabled?: boolean;
}) {
  const search = new URLSearchParams({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  if (params.projectId) search.set("projectId", params.projectId);

  return useQuery({
    queryKey: ["reports", "revenue-pipeline", search.toString()],
    queryFn: () =>
      apiGet<RevenuePipelineReport>(`/api/reports/revenue-pipeline?${search.toString()}`),
    enabled: params.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

export async function downloadRevenuePipelineCsv(params: {
  dateFrom: string;
  dateTo: string;
  projectId?: string;
}) {
  const search = new URLSearchParams({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  if (params.projectId) search.set("projectId", params.projectId);
  await apiDownload(
    `/api/reports/revenue-pipeline/export?${search.toString()}`,
    `revenue-pipeline-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

export function formatInr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}
