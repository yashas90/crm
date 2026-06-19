import { describe, expect, it } from "vitest";
import {
  buildWhatsAppUrl,
  buildWhatsAppUrlCandidates,
  formatWhatsAppPhone,
  substituteMessageTemplate,
} from "./messageTemplates.js";

describe("substituteMessageTemplate", () => {
  const fullVars = {
    leadName: "Rahul Sharma",
    agentName: "Priya Agent",
    projectName: "Skyline Residency",
    unitNumber: "A-1204",
    priceListedRs: "8500000",
  };

  it("fills all variables", () => {
    const result = substituteMessageTemplate(
      "Hi {{leadName}}, {{agentName}} from {{projectName}}. Unit {{unitNumber}} at ₹{{priceListedRs}}.",
      fullVars,
    );
    expect(result).toContain("Rahul Sharma");
    expect(result).toContain("Priya Agent");
    expect(result).toContain("Skyline Residency");
    expect(result).toContain("A-1204");
    expect(result).toContain("85,00,000");
  });

  it("handles missing optional variables gracefully", () => {
    const result = substituteMessageTemplate(
      "Hi {{leadName}},\nUnit: {{unitNumber}}\nPrice: ₹{{priceListedRs}}",
      { leadName: "Rahul" },
    );
    expect(result).toBe("Hi Rahul,");
  });

  it("returns empty string when all content lines are blank", () => {
    const result = substituteMessageTemplate("Unit: {{unitNumber}}\nPrice: ₹{{priceListedRs}}", {});
    expect(result).toBe("");
  });
});

describe("formatWhatsAppPhone", () => {
  it("adds +91 for 10-digit Indian numbers", () => {
    expect(formatWhatsAppPhone("9876543210")).toBe("919876543210");
  });

  it("keeps 12-digit numbers starting with 91", () => {
    expect(formatWhatsAppPhone("+91 98765 43210")).toBe("919876543210");
  });
});

describe("buildWhatsAppUrl", () => {
  it("builds wa.me link for web", () => {
    const url = buildWhatsAppUrl("9876543210", "Hello there");
    expect(url).toBe("https://wa.me/919876543210?text=Hello%20there");
  });

  it("builds deep link when preferred", () => {
    const url = buildWhatsAppUrl("9876543210", "Hello", { preferDeepLink: true });
    expect(url).toMatch(/^whatsapp:\/\/send\?phone=919876543210&text=/);
  });

  it("includes deep link and web fallback candidates", () => {
    const urls = buildWhatsAppUrlCandidates("9876543210", "Hi");
    expect(urls[0]).toMatch(/^whatsapp:\/\//);
    expect(urls[1]).toMatch(/^https:\/\/wa\.me\//);
  });
});
