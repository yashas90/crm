import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./env.js", () => ({
  env: {
    META_PAGE_ID: "page-123",
    META_FORM_IDS: "form-a, form-b",
  },
}));

describe("metaWebhookScope", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("allows matching page and form", async () => {
    const { isMetaLeadgenAllowed } = await import("./metaWebhookScope.js");
    expect(
      isMetaLeadgenAllowed({
        leadgen_id: "1",
        page_id: "page-123",
        form_id: "form-a",
      }).allowed,
    ).toBe(true);
  });

  it("rejects mismatched page", async () => {
    const { isMetaLeadgenAllowed } = await import("./metaWebhookScope.js");
    expect(
      isMetaLeadgenAllowed({
        leadgen_id: "1",
        page_id: "other-page",
        form_id: "form-a",
      }),
    ).toEqual({ allowed: false, reason: "page_id_mismatch" });
  });

  it("rejects form outside allowlist", async () => {
    const { isMetaLeadgenAllowed } = await import("./metaWebhookScope.js");
    expect(
      isMetaLeadgenAllowed({
        leadgen_id: "1",
        page_id: "page-123",
        form_id: "form-z",
      }),
    ).toEqual({ allowed: false, reason: "form_id_not_allowed" });
  });
});
