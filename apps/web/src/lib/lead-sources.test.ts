import { describe, expect, it } from "vitest";
import {
  formatLeadSourceDisplay,
  getAdLeadInfo,
  isAdLeadLead,
  normalizeLeadSourceValue,
} from "./lead-sources";

describe("lead-sources", () => {
  it("normalizes legacy slugs to canonical labels", () => {
    expect(normalizeLeadSourceValue("facebook")).toBe("Facebook Ads");
    expect(normalizeLeadSourceValue("google-ads")).toBe("Google Ads");
    expect(normalizeLeadSourceValue("walk-in")).toBe("Walk In");
  });

  it("formats display labels for legacy stored values", () => {
    expect(formatLeadSourceDisplay("facebook")).toBe("Facebook Ads");
    expect(formatLeadSourceDisplay("Facebook Ads")).toBe("Facebook Ads");
  });

  it("detects ad leads by source or tag", () => {
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
});
