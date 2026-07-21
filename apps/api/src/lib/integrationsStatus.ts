import { facebookPages, facebookTokens } from "@propninja/db";
import { and, count, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";
import { env } from "./env.js";
import { isGoogleAdsConfigured } from "./googleAds.js";
import { GOOGLE_ADS_INTEGRATION, getIntegrationSyncState } from "./integrationSyncState.js";
import { getMetaWebhookScopeSummary } from "./metaWebhookScope.js";

export type IntegrationConnectionStatus = "live" | "ready" | "not_configured";

export type IntegrationsStatus = {
  facebook: {
    status: IntegrationConnectionStatus;
    enabled: boolean;
    oauthConnected: boolean;
    activePages: number;
    activeForms: number;
    leadgenSubscribedPages: number;
    webhookSignatureConfigured: boolean;
    verifyTokenConfigured: boolean;
    pageScopingEnabled: boolean;
    formScopingEnabled: boolean;
    /** @deprecated Prefer activePages — kept for older UI clients */
    pageId?: string;
    /** @deprecated Prefer activeForms */
    formIds?: string[];
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

function metaConnectionStatus(input: {
  verifyConfigured: boolean;
  webhookSignatureConfigured: boolean;
  oauthOrPages: boolean;
}): IntegrationConnectionStatus {
  if (!input.verifyConfigured || !input.webhookSignatureConfigured) {
    return "not_configured";
  }
  if (!input.oauthOrPages) {
    return "ready";
  }
  return "live";
}

function googleAdsIsLive(enabled: boolean, syncEnabled: boolean): IntegrationConnectionStatus {
  return enabled && syncEnabled ? "live" : "not_configured";
}

export async function getIntegrationsStatus(): Promise<IntegrationsStatus> {
  const webhookSignatureConfigured = Boolean(env.META_APP_SECRET?.trim());
  const verifyConfigured = Boolean(env.META_VERIFY_TOKEN?.trim());

  const [tokenRow] = await db
    .select({ value: count() })
    .from(facebookTokens)
    .where(
      and(
        eq(facebookTokens.orgId, SINGLE_TENANT_ORG_ID),
        eq(facebookTokens.tokenType, "user"),
        eq(facebookTokens.status, "active"),
      ),
    );

  const [pageTokenRows] = await db
    .select({ value: count() })
    .from(facebookPages)
    .where(
      and(
        eq(facebookPages.orgId, SINGLE_TENANT_ORG_ID),
        eq(facebookPages.isActive, true),
        eq(facebookPages.isSelected, true),
      ),
    );

  const oauthConnected = (tokenRow?.value ?? 0) > 0;
  const oauthOrPages = oauthConnected || (pageTokenRows?.value ?? 0) > 0;
  const facebookEnabled = verifyConfigured && oauthOrPages;
  const metaScope = await getMetaWebhookScopeSummary(SINGLE_TENANT_ORG_ID);

  const googleAdsEnabled = isGoogleAdsConfigured();
  const googleState = googleAdsEnabled
    ? await getIntegrationSyncState(GOOGLE_ADS_INTEGRATION)
    : null;
  const syncEnabled = googleAdsEnabled && env.GOOGLE_ADS_SYNC_ENABLED;

  return {
    facebook: {
      status: metaConnectionStatus({
        verifyConfigured,
        webhookSignatureConfigured,
        oauthOrPages,
      }),
      enabled: facebookEnabled,
      oauthConnected,
      activePages: metaScope.activePages,
      activeForms: metaScope.activeForms,
      leadgenSubscribedPages: metaScope.leadgenSubscribedPages,
      webhookSignatureConfigured,
      verifyTokenConfigured: verifyConfigured,
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
