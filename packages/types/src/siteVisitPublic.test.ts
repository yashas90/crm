import { describe, expect, it } from "vitest";
import {
  buildCustomerToAgentWhatsAppMessage,
  buildSiteVisitCustomerUrl,
} from "./siteVisitPublic.js";

describe("siteVisitPublic", () => {
  it("builds customer portal URL", () => {
    expect(buildSiteVisitCustomerUrl("SV-2026-A1B2C3D4")).toBe(
      "https://www.ninjamarketing.in/sitevisit/SV-2026-A1B2C3D4",
    );
    expect(buildSiteVisitCustomerUrl("SV-2026-A1B2C3D4", "https://crm.example.com")).toBe(
      "https://crm.example.com/sitevisit/SV-2026-A1B2C3D4",
    );
  });

  it("builds customer-to-agent WhatsApp message", () => {
    const message = buildCustomerToAgentWhatsAppMessage({
      customerName: "Priya",
      customerPhone: "9876543210",
      projectName: "Nikoo 9",
      unitLabel: "1204",
      tower: "Tower A",
      visitDate: "2026-07-12",
      visitTime: "11:00:00",
      mapsLink: null,
      meetingLocation: "Sales office",
      agentName: "Rahul Kumar",
      agentPhone: "9876543210",
      duration: 60,
    });
    expect(message).toContain("Hi Rahul Kumar");
    expect(message).toContain("12 July 2026");
    expect(message).toContain("Nikoo 9");
  });
});
