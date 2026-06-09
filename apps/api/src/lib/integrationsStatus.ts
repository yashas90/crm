import { env } from "./env.js";
import { isGoogleAdsConfigured } from "./googleAds.js";
import { GOOGLE_ADS_INTEGRATION, getIntegrationSyncState } from "./integrationSyncState.js";
import { getMetaWebhookScopeConfig } from "./metaWebhookScope.js";

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

export async function getIntegrationsStatus(): Promise<IntegrationsStatus> {
  const facebookEnabled = Boolean(env.PAGE_ACCESS_TOKEN?.trim() && env.META_VERIFY_TOKEN?.trim());
  const googleAdsEnabled = isGoogleAdsConfigured();
  const googleState = googleAdsEnabled
    ? await getIntegrationSyncState(GOOGLE_ADS_INTEGRATION)
    : null;
  const metaScope = getMetaWebhookScopeConfig();

  return {
    facebook: {
      enabled: facebookEnabled,
      pageId: metaScope.pageId,
      formIds: metaScope.formIds,
      webhookSignatureConfigured: Boolean(env.META_APP_SECRET?.trim()),
      pageScopingEnabled: metaScope.pageScopingEnabled,
      formScopingEnabled: metaScope.formScopingEnabled,
    },
    googleAds: {
      enabled: googleAdsEnabled,
      customerId: env.GOOGLE_ADS_CUSTOMER_ID?.trim() || undefined,
      syncEnabled: googleAdsEnabled && env.GOOGLE_ADS_SYNC_ENABLED,
      lastSyncAt: googleState?.lastSuccessAt?.toISOString(),
      lastSyncError: googleState?.lastError ?? undefined,
    },
  };
}
