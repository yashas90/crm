"use client";

import { apiGet } from "@/lib/apiClient";
import { SILENT_QUERY_ERROR_META } from "@/lib/query-meta";
import type { SlaBreachedList, SlaSummary } from "@/lib/sla";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type SlaBreachedQuery = {
  inactiveDays?: number;
  status?: string;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
};

export function slaSummaryQueryKey() {
  return ["sla", "summary"] as const;
}

export function slaBreachedQueryKey(params: SlaBreachedQuery) {
  return ["sla", "breached", params] as const;
}

export function useSlaSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: slaSummaryQueryKey(),
    queryFn: () => apiGet<SlaSummary>("/api/sla/summary"),
    enabled: options?.enabled !== false,
    staleTime: 60_000,
    meta: SILENT_QUERY_ERROR_META,
  });
}

export function useSlaBreached(params: SlaBreachedQuery, options?: { enabled?: boolean }) {
  const query = {
    inactiveDays: params.inactiveDays ?? 3,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    ...(params.status ? { status: params.status } : {}),
    ...(params.assignedTo ? { assignedTo: params.assignedTo } : {}),
  };

  const search = new URLSearchParams({
    inactiveDays: String(query.inactiveDays),
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.status) search.set("status", query.status);
  if (query.assignedTo) search.set("assignedTo", query.assignedTo);

  return useQuery({
    queryKey: slaBreachedQueryKey(query),
    queryFn: () => apiGet<SlaBreachedList>(`/api/sla/breached?${search.toString()}`),
    enabled: options?.enabled !== false,
    placeholderData: keepPreviousData,
  });
}
