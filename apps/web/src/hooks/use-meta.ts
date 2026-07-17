"use client";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MetaDashboardData = {
  assets: {
    businesses: number;
    pages: number;
    pixels: number;
    forms: number;
    adAccounts: number;
  };
  leads: {
    today: number;
    yesterday: number;
    last7Days: number;
    last30Days: number;
  };
  topCampaigns: Array<{
    id: string;
    campaignId: string;
    name: string;
    status: string | null;
    spend: number;
  }>;
  token: {
    connected: boolean;
    status: string | null;
    expiresAt: string | null;
    expiringSoon: boolean;
  };
  webhooks: Record<string, number>;
  conversionEvents: Record<string, number>;
};

export function useMetaDashboard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meta", "dashboard"],
    queryFn: () => apiGet<MetaDashboardData>("/api/meta/dashboard"),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
  });
}

export function useMetaConnect() {
  return useMutation({
    mutationFn: () => apiPost<{ url: string }>("/api/meta/connect", {}),
  });
}

export function useMetaDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<{ disconnected: boolean }>("/api/meta/disconnect"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta"] });
    },
  });
}

export function useMetaSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { type?: "campaigns" | "insights" | "all" }) =>
      apiPost<Record<string, unknown>>("/api/meta/sync", body ?? { type: "all" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta"] });
    },
  });
}

export function useMetaTokenRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPut<{ refreshed: boolean }>("/api/meta/token", {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta"] });
    },
  });
}
