import {
  buildWhatsAppUrlCandidates,
  formatWhatsAppPhone,
  substituteMessageTemplate,
} from "@propninja/types/message-templates";

describe("whatsappTemplates", () => {
  it("substitutes variables for preview", () => {
    const result = substituteMessageTemplate("Hi {{leadName}} from {{agentName}}", {
      leadName: "Rahul",
      agentName: "Priya",
    });
    expect(result).toBe("Hi Rahul from Priya");
  });

  it("formats phone with +91 prefix", () => {
    expect(formatWhatsAppPhone("9876543210")).toBe("919876543210");
  });

  it("prefers deep link in candidate list", () => {
    const urls = buildWhatsAppUrlCandidates("9876543210", "Hello");
    expect(urls[0]).toMatch(/^whatsapp:\/\//);
    expect(urls[1]).toMatch(/^https:\/\/wa\.me\//);
  });
});
