import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./env.js", () => ({
  env: {
    PAGE_ACCESS_TOKEN: "page-token",
    META_VERIFY_TOKEN: "verify-token",
    META_APP_SECRET: "app-secret",
    META_PAGE_ID: "1122334455",
    META_FORM_IDS: "form-a, form-b",
    GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token",
    GOOGLE_ADS_CLIENT_ID: "client-id",
    GOOGLE_ADS_CLIENT_SECRET: "client-secret",
    GOOGLE_ADS_REFRESH_TOKEN: "refresh-token",
    GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
    GOOGLE_ADS_SYNC_ENABLED: true,
  },
}));

vi.mock("./integrationSyncState.js", () => ({
  getIntegrationSyncState: vi.fn(async () => ({
    integration: "google_ads",
    orgId: "00000000-0000-0000-0000-0000000000aa",
    lastSuccessAt: new Date("2025-06-01T10:00:00.000Z"),
    lastError: null,
    updatedAt: new Date("2025-06-01T10:00:00.000Z"),
  })),
  GOOGLE_ADS_INTEGRATION: "google_ads",
}));

describe("getIntegrationsStatus", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("reports configured integrations from env", async () => {
    const { getIntegrationsStatus } = await import("./integrationsStatus.js");
    expect(await getIntegrationsStatus()).toEqual({
      facebook: {
        enabled: true,
        pageId: "1122334455",
        formIds: ["form-a", "form-b"],
        webhookSignatureConfigured: true,
        pageScopingEnabled: true,
        formScopingEnabled: true,
      },
      googleAds: {
        enabled: true,
        customerId: "123-456-7890",
        syncEnabled: true,
        lastSyncAt: "2025-06-01T10:00:00.000Z",
        lastSyncError: undefined,
      },
    });
  });
});
