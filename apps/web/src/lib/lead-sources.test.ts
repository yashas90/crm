import { describe, expect, it } from "vitest";
import {
  BULK_UPLOAD_SOURCE_OPTIONS,
  formatLeadSourceDisplay,
  getAdLeadInfo,
  isAdLeadLead,
  normalizeLeadSourceValue,
} from "./lead-sources";

describe("lead-sources", () => {
  it("normalizes legacy slugs to canonical labels", () => {
    expect(normalizeLeadSourceValue("facebook")).toBe("Meta Ads");
    expect(normalizeLeadSourceValue("Facebook Ads")).toBe("Meta Ads");
    expect(normalizeLeadSourceValue("Facebook / Meta")).toBe("Meta Ads");
    expect(normalizeLeadSourceValue("FB")).toBe("Meta Ads");
    expect(normalizeLeadSourceValue("google-ads")).toBe("Google Ads");
    expect(normalizeLeadSourceValue("walk-in")).toBe("Walk In");
  });

  it("formats display labels for legacy stored values", () => {
    expect(formatLeadSourceDisplay("facebook")).toBe("Meta Ads");
    expect(formatLeadSourceDisplay("Facebook Ads")).toBe("Meta Ads");
    expect(formatLeadSourceDisplay("Meta Ads")).toBe("Meta Ads");
  });

  it("detects ad leads by source or tag", () => {
    expect(isAdLeadLead({ leadSource: "Meta Ads", tags: [] })).toBe(true);
    expect(isAdLeadLead({ leadSource: "Facebook Ads", tags: [] })).toBe(true);
    expect(isAdLeadLead({ leadSource: "website", tags: ["ad_lead"] })).toBe(true);
    expect(isAdLeadLead({ leadSource: "website", tags: [] })).toBe(false);
  });

  it("reads ad lead custom fields", () => {
    const info = getAdLeadInfo({
      lastAdLead: {
        campaignName: "Summer Launch",
        externalLeadId: "123",
        ingestedAt: "2025-06-01T10:00:00.000Z",
      },
    });
    expect(info.payload?.campaignName).toBe("Summer Launch");
    expect(info.ingestedAt).toBe("2025-06-01T10:00:00.000Z");
  });

  it("includes portal and ad sources for bulk upload", () => {
    const values = BULK_UPLOAD_SOURCE_OPTIONS.map((option) => option.value);
    expect(values).toContain("Meta Ads");
    expect(values).toContain("Magicbricks");
    expect(values).toContain("99 Acres");
    expect(values).toContain("Cold Call");
  });
});
