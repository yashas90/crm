import { beforeEach, describe, expect, it, vi } from "vitest";

const limitResults: unknown[][] = [];
let limitCall = 0;

vi.mock("./db.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            const result = limitResults[limitCall] ?? [];
            limitCall += 1;
            return result;
          },
        }),
      }),
    }),
  },
}));

vi.mock("./constants.js", () => ({
  SINGLE_TENANT_ORG_ID: "00000000-0000-0000-0000-0000000000aa",
}));

describe("metaWebhookScope (DB)", () => {
  beforeEach(() => {
    vi.resetModules();
    limitResults.length = 0;
    limitCall = 0;
  });

  it("rejects unknown page", async () => {
    limitResults.push([]);
    const { isMetaLeadgenAllowed } = await import("./metaWebhookScope.js");
    await expect(
      isMetaLeadgenAllowed({ leadgen_id: "1", page_id: "missing", form_id: "f1" }),
    ).resolves.toEqual({ allowed: false, reason: "page_not_connected" });
  });

  it("rejects disabled page", async () => {
    limitResults.push([{ id: "p1", isActive: false, isSelected: true, hasToken: "enc" }]);
    const { isMetaLeadgenAllowed } = await import("./metaWebhookScope.js");
    await expect(
      isMetaLeadgenAllowed({ leadgen_id: "1", page_id: "page-1", form_id: "f1" }),
    ).resolves.toEqual({ allowed: false, reason: "page_disabled" });
  });

  it("allows active page and selected form", async () => {
    limitResults.push(
      [{ id: "p1", isActive: true, isSelected: true, hasToken: "enc" }],
      [{ id: "frow", isActive: true, isSelected: true }],
    );
    const { isMetaLeadgenAllowed } = await import("./metaWebhookScope.js");
    await expect(
      isMetaLeadgenAllowed({ leadgen_id: "1", page_id: "page-1", form_id: "form-a" }),
    ).resolves.toMatchObject({ allowed: true, pageRowId: "p1", formRowId: "frow" });
  });

  it("allows unknown form on known page (pre-sync)", async () => {
    limitResults.push([{ id: "p1", isActive: true, isSelected: true, hasToken: "enc" }], []);
    const { isMetaLeadgenAllowed } = await import("./metaWebhookScope.js");
    await expect(
      isMetaLeadgenAllowed({ leadgen_id: "1", page_id: "page-1", form_id: "new-form" }),
    ).resolves.toMatchObject({ allowed: true, reason: "form_not_synced_yet" });
  });
});
