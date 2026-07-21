"use client";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/apiClient";
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

export type MetaPage = {
  id: string;
  pageId: string;
  name: string;
  category: string | null;
  hasAccessToken: boolean;
  isSelected: boolean;
  isActive: boolean;
  leadgenSubscribed: boolean;
  projectId: string | null;
  updatedAt: string;
};

export type MetaForm = {
  id: string;
  pageId: string;
  formId: string;
  name: string;
  status: string | null;
  isSelected: boolean;
  isActive: boolean;
  projectId: string | null;
};

export type MetaBusiness = {
  id: string;
  businessId: string;
  name: string;
  verificationStatus: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type MetaAdAccount = {
  id: string;
  adAccountId: string;
  name: string;
  currency: string | null;
  timezoneName: string | null;
  accountStatus: number | null;
  isSelected: boolean;
  isActive: boolean;
  projectId?: string | null;
  updatedAt: string;
};

export type MetaCampaign = {
  id: string;
  adAccountId: string | null;
  campaignId: string;
  name: string;
  status: string | null;
  objective: string | null;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  insights: Record<string, unknown>;
};

export type MetaAdset = {
  id: string;
  campaignId: string | null;
  adsetId: string;
  name: string;
  status: string | null;
  dailyBudget: string | null;
  insights: Record<string, unknown>;
};

export type MetaAd = {
  id: string;
  adsetId: string | null;
  adId: string;
  name: string;
  status: string | null;
  creativeId: string | null;
  insights: Record<string, unknown>;
};

export type MetaPixel = {
  id: string;
  pixelId: string;
  name: string;
  isSelected: boolean;
  isActive: boolean;
  isDefault: boolean;
  updatedAt: string;
};

export type MetaSyncHistory = {
  id: string;
  syncType: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage: string | null;
};

export function useMetaDashboard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meta", "dashboard"],
    queryFn: () => apiGet<MetaDashboardData>("/api/meta/dashboard"),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
  });
}

export function useMetaBusinesses(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meta", "businesses"],
    queryFn: () => apiGet<MetaBusiness[]>("/api/meta/businesses"),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
  });
}

export function useMetaPages(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meta", "pages"],
    queryFn: () => apiGet<MetaPage[]>("/api/meta/pages"),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
  });
}

export function useMetaForms(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meta", "forms"],
    queryFn: () => apiGet<MetaForm[]>("/api/meta/forms"),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
  });
}

export function useMetaAdAccounts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meta", "adaccounts"],
    queryFn: () => apiGet<MetaAdAccount[]>("/api/meta/adaccounts"),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
  });
}

export function useMetaCampaigns(options?: { enabled?: boolean; adAccountId?: string }) {
  const qs = options?.adAccountId ? `?adAccountId=${encodeURIComponent(options.adAccountId)}` : "";
  return useQuery({
    queryKey: ["meta", "campaigns", options?.adAccountId ?? "all"],
    queryFn: () => apiGet<MetaCampaign[]>(`/api/meta/campaigns${qs}`),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
  });
}

export function useMetaAdsets(options?: { enabled?: boolean; campaignId?: string }) {
  const qs = options?.campaignId ? `?campaignId=${encodeURIComponent(options.campaignId)}` : "";
  return useQuery({
    queryKey: ["meta", "adsets", options?.campaignId ?? "all"],
    queryFn: () => apiGet<MetaAdset[]>(`/api/meta/adsets${qs}`),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
  });
}

export function useMetaAds(options?: { enabled?: boolean; adsetId?: string }) {
  const qs = options?.adsetId ? `?adsetId=${encodeURIComponent(options.adsetId)}` : "";
  return useQuery({
    queryKey: ["meta", "ads", options?.adsetId ?? "all"],
    queryFn: () => apiGet<MetaAd[]>(`/api/meta/ads${qs}`),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
  });
}

export function useMetaPixels(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meta", "pixels"],
    queryFn: () => apiGet<MetaPixel[]>("/api/meta/pixels"),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
  });
}

export function useMetaSyncHistory(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["meta", "sync-history"],
    queryFn: () => apiGet<MetaSyncHistory[]>("/api/meta/sync-history?page=1&pageSize=10"),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
  });
}

export function useMetaConnect() {
  return useMutation({
    mutationFn: () => apiGet<{ url: string }>("/api/meta/oauth"),
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
    mutationFn: (body?: { type?: "campaigns" | "insights" | "assets" | "all" }) =>
      apiPost<Record<string, unknown>>("/api/meta/sync", body ?? { type: "all" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta"] });
    },
  });
}

export function useMetaSyncAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<{
        pagesUpserted: number;
        formsUpserted: number;
        subscribed: number;
        subscribeFailed: number;
      }>("/api/meta/sync/assets", {}),
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

export function useMetaPatchPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      isActive?: boolean;
      isSelected?: boolean;
      projectId?: string | null;
    }) => apiPatch<MetaPage>(`/api/meta/pages/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta"] });
    },
  });
}

export function useMetaReconnectPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<{ reconnected: boolean; formsUpserted: number; subscribed: boolean }>(
        `/api/meta/pages/${id}/reconnect`,
        {},
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta"] });
    },
  });
}

export function useMetaPatchForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      isActive?: boolean;
      isSelected?: boolean;
      projectId?: string | null;
    }) => apiPatch<MetaForm>(`/api/meta/forms/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta"] });
    },
  });
}
