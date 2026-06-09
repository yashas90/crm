"use client";

import { apiGet } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

export type IntegrationsStatus = {
  facebook: {
    enabled: boolean;
    pageId?: string;
    formIds?: string[];
    webhookSignatureConfigured: boolean;
    pageScopingEnabled: boolean;
    formScopingEnabled: boolean;
  };
  googleAds: {
    enabled: boolean;
    customerId?: string;
    syncEnabled: boolean;
    lastSyncAt?: string;
    lastSyncError?: string;
  };
};

export function useIntegrationsStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["integrations", "status"],
    queryFn: () => apiGet<IntegrationsStatus>("/api/integrations/status"),
    enabled: options?.enabled !== false,
    staleTime: 60_000,
  });
}
