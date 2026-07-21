"use client";

import { apiGet } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

export type IntegrationConnectionStatus = "live" | "ready" | "not_configured";

export type IntegrationsStatus = {
  facebook: {
    status: IntegrationConnectionStatus;
    enabled: boolean;
    oauthConnected?: boolean;
    activePages?: number;
    activeForms?: number;
    leadgenSubscribedPages?: number;
    pageId?: string;
    formIds?: string[];
    webhookSignatureConfigured: boolean;
    verifyTokenConfigured?: boolean;
    pageScopingEnabled: boolean;
    formScopingEnabled: boolean;
  };
  googleAds: {
    status: IntegrationConnectionStatus;
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
