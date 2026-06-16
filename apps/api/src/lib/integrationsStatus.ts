import { env } from "./env.js";
import { isGoogleAdsConfigured } from "./googleAds.js";
import { GOOGLE_ADS_INTEGRATION, getIntegrationSyncState } from "./integrationSyncState.js";
import { getMetaWebhookScopeConfig } from "./metaWebhookScope.js";

export type IntegrationConnectionStatus = "live" | "not_configured";

export type IntegrationsStatus = {
  facebook: {
    status: IntegrationConnectionStatus;
    enabled: boolean;
    pageId?: string;
    formIds?: string[];
    webhookSignatureConfigured: boolean;
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

function metaIsLive(
  enabled: boolean,
  webhookSignatureConfigured: boolean,
): IntegrationConnectionStatus {
  return enabled && webhookSignatureConfigured ? "live" : "not_configured";
}

function googleAdsIsLive(enabled: boolean, syncEnabled: boolean): IntegrationConnectionStatus {
  return enabled && syncEnabled ? "live" : "not_configured";
}

export async function getIntegrationsStatus(): Promise<IntegrationsStatus> {
  const facebookEnabled = Boolean(env.PAGE_ACCESS_TOKEN?.trim() && env.META_VERIFY_TOKEN?.trim());
  const webhookSignatureConfigured = Boolean(env.META_APP_SECRET?.trim());
  const googleAdsEnabled = isGoogleAdsConfigured();
  const googleState = googleAdsEnabled
    ? await getIntegrationSyncState(GOOGLE_ADS_INTEGRATION)
    : null;
  const metaScope = getMetaWebhookScopeConfig();
  const syncEnabled = googleAdsEnabled && env.GOOGLE_ADS_SYNC_ENABLED;

  return {
    facebook: {
      status: metaIsLive(facebookEnabled, webhookSignatureConfigured),
      enabled: facebookEnabled,
      pageId: metaScope.pageId,
      formIds: metaScope.formIds,
      webhookSignatureConfigured,
      pageScopingEnabled: metaScope.pageScopingEnabled,
      formScopingEnabled: metaScope.formScopingEnabled,
    },
    googleAds: {
      status: googleAdsIsLive(googleAdsEnabled, syncEnabled),
      enabled: googleAdsEnabled,
      customerId: env.GOOGLE_ADS_CUSTOMER_ID?.trim() || undefined,
      syncEnabled,
      lastSyncAt: googleState?.lastSuccessAt?.toISOString(),
      lastSyncError: googleState?.lastError ?? undefined,
    },
  };
}
