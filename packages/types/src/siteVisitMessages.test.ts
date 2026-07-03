import { describe, expect, it } from "vitest";
import {
  buildAgentSiteVisitMessage,
  buildCustomerSiteVisitMessage,
  prepareSiteVisitWhatsApp,
} from "./siteVisitMessages.js";

const ctx = {
  customerName: "Priya Sharma",
  customerPhone: "+919876543210",
  projectName: "Sunrise Heights",
  unitLabel: "1204",
  tower: "Tower B",
  visitDate: "2026-07-15",
  visitTime: "10:30:00",
  mapsLink: "https://maps.google.com/?q=Sunrise",
  meetingLocation: "Sales office",
  agentName: "Ravi Kumar",
  agentPhone: "+919111223344",
  duration: 60,
};

describe("siteVisitMessages", () => {
  it("builds customer scheduled message with required fields", () => {
    const message = buildCustomerSiteVisitMessage("scheduled", ctx);
    expect(message).toContain("PropNinja Consulting");
    expect(message).toContain("Priya Sharma");
    expect(message).toContain("Sunrise Heights");
    expect(message).toContain("https://maps.google.com/?q=Sunrise");
    expect(message).toContain("Ravi Kumar");
  });

  it("builds agent assignment message", () => {
    const message = buildAgentSiteVisitMessage("scheduled", ctx);
    expect(message).toContain("New Site Visit Assigned");
    expect(message).toContain("Priya Sharma");
    expect(message).toContain("+919876543210");
  });

  it("prepares wa.me link without Meta API", () => {
    const result = prepareSiteVisitWhatsApp("customer", "scheduled", ctx, "+919876543210");
    expect(result.prepared).toBe(true);
    expect(result.whatsappUrl).toContain("wa.me/919876543210");
    expect(result.whatsappUrl).toContain(encodeURIComponent("Priya Sharma"));
  });

  it("returns NO_PHONE when phone missing", () => {
    const result = prepareSiteVisitWhatsApp("customer", "scheduled", ctx, null);
    expect(result.prepared).toBe(false);
    expect(result.error).toBe("NO_PHONE");
  });
});
