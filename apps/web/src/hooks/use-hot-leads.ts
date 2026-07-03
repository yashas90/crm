"use client";

import type { LeadRow } from "@/hooks/use-leads";
import { apiGet } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

export function useHotLeads(limit = 10, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["leads", "hot", limit],
    queryFn: () => apiGet<{ items: LeadRow[]; total: number }>(`/api/leads/hot?limit=${limit}`),
    enabled: options?.enabled !== false,
    staleTime: 60_000,
  });
}
