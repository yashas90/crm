import { describe, expect, it } from "vitest";
import {
  isCapiTrackedLeadStatus,
  mapLeadStatusToCapiEvent,
  mapSiteVisitToCapiEvent,
} from "./metaStatusMap.js";

describe("metaStatusMap", () => {
  it("maps CRM statuses to CAPI events", () => {
    expect(mapLeadStatusToCapiEvent("new")).toBe("Lead");
    expect(mapLeadStatusToCapiEvent("contacted")).toBe("Contact");
    expect(mapLeadStatusToCapiEvent("qualified")).toBe("QualifiedLead");
    expect(mapLeadStatusToCapiEvent("won")).toBe("Purchase");
  });

  it("skips statuses without advertiser value", () => {
    expect(mapLeadStatusToCapiEvent("negotiation")).toBeNull();
    expect(mapLeadStatusToCapiEvent("lost")).toBeNull();
    expect(mapLeadStatusToCapiEvent("dropped")).toBeNull();
    expect(isCapiTrackedLeadStatus("lost")).toBe(false);
    expect(isCapiTrackedLeadStatus("new")).toBe(true);
  });

  it("maps site visits to Schedule", () => {
    expect(mapSiteVisitToCapiEvent()).toBe("Schedule");
  });
});
