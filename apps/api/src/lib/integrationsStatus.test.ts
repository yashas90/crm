import { describe, expect, it, vi } from "vitest";

vi.mock("./env.js", () => ({
  env: {
    META_APP_SECRET: "secret",
    META_VERIFY_TOKEN: "verify",
    GOOGLE_ADS_SYNC_ENABLED: false,
  },
}));

vi.mock("./googleAds.js", () => ({
  isGoogleAdsConfigured: () => false,
}));

vi.mock("./integrationSyncState.js", () => ({
  GOOGLE_ADS_INTEGRATION: "google_ads",
  getIntegrationSyncState: vi.fn(),
}));

vi.mock("./constants.js", () => ({
  SINGLE_TENANT_ORG_ID: "00000000-0000-0000-0000-0000000000aa",
}));

vi.mock("./db.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => [{ value: 1 }],
      }),
    }),
  },
}));

vi.mock("./metaWebhookScope.js", () => ({
  getMetaWebhookScopeSummary: async () => ({
    activePages: 2,
    activeForms: 5,
    leadgenSubscribedPages: 2,
    pageScopingEnabled: true,
    formScopingEnabled: true,
  }),
}));

describe("getIntegrationsStatus", () => {
  it("reports Meta live from DB pages + app secret", async () => {
    const { getIntegrationsStatus } = await import("./integrationsStatus.js");
    const status = await getIntegrationsStatus();
    expect(status.facebook.status).toBe("live");
    expect(status.facebook.activePages).toBe(2);
    expect(status.facebook.activeForms).toBe(5);
    expect(status.facebook.leadgenSubscribedPages).toBe(2);
    expect(status.facebook.webhookSignatureConfigured).toBe(true);
  });
});
