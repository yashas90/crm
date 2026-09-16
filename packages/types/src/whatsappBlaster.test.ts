import { describe, expect, it } from "vitest";
import {
  DEFAULT_WHATSAPP_QUESTION_FLOW,
  detectCallBackIntent,
  detectInterestedIntent,
  detectNotInterestedIntent,
  formatIndianWhatsAppPhone,
  formatWhatsAppCampaignCode,
  formatWhatsAppLeadCode,
  mapWhatsAppContacts,
  nextQuestionAfterAnswer,
  parseDelimitedTable,
  renderWhatsAppTemplate,
} from "./whatsappBlaster.js";

describe("formatIndianWhatsAppPhone", () => {
  it("formats 10-digit Indian mobiles", () => {
    expect(formatIndianWhatsAppPhone("9876543210")).toBe("+919876543210");
    expect(formatIndianWhatsAppPhone("+91 98765 43210")).toBe("+919876543210");
    expect(formatIndianWhatsAppPhone("0919876543210")).toBe("+919876543210");
  });

  it("rejects invalid numbers", () => {
    expect(formatIndianWhatsAppPhone("12345")).toBeNull();
    expect(formatIndianWhatsAppPhone("1876543210")).toBeNull();
    expect(formatIndianWhatsAppPhone("")).toBeNull();
  });
});

describe("mapWhatsAppContacts", () => {
  it("counts valid, invalid, and duplicate phones", () => {
    const parsed = mapWhatsAppContacts(
      ["Name", "Phone", "City", "Budget"],
      [
        ["Priya", "9876543210", "Bengaluru", "80L"],
        ["Amit", "9876543210", "Mysore", "50L"],
        ["Bad", "123", "Pune", ""],
        ["Ok", "+91 9123456789", "Chennai", "1Cr"],
      ],
      { name: "Name", phone: "Phone", city: "City", budget: "Budget" },
    );
    expect(parsed.total).toBe(4);
    expect(parsed.valid).toBe(2);
    expect(parsed.duplicates).toBe(1);
    expect(parsed.invalid).toBe(1);
  });
});

describe("parseDelimitedTable", () => {
  it("parses quoted CSV", () => {
    const { headers, rows } = parseDelimitedTable('Name,Phone\n"Sharma, R",9876543210');
    expect(headers).toEqual(["Name", "Phone"]);
    expect(rows[0]).toEqual(["Sharma, R", "9876543210"]);
  });
});

describe("question flow", () => {
  it("advances from budget to location then completes after timeline", () => {
    const budget = nextQuestionAfterAnswer(
      DEFAULT_WHATSAPP_QUESTION_FLOW,
      "q_budget",
      "₹50L - ₹1 Crore",
    );
    expect(budget.option?.mapsTo).toBe("budget");
    expect(budget.nextQuestion?.id).toBe("q_location");

    const timeline = nextQuestionAfterAnswer(
      DEFAULT_WHATSAPP_QUESTION_FLOW,
      "q_timeline",
      "Just exploring",
    );
    expect(timeline.completed).toBe(true);
    expect(timeline.nextQuestion).toBeNull();
  });
});

describe("intents", () => {
  it("detects yes / no / call keywords", () => {
    expect(detectInterestedIntent("YES")).toBe(true);
    expect(detectInterestedIntent("I am interested")).toBe(true);
    expect(detectNotInterestedIntent("STOP")).toBe(true);
    expect(detectNotInterestedIntent("No")).toBe(true);
    expect(detectCallBackIntent("Call")).toBe(true);
  });
});

describe("helpers", () => {
  it("formats codes and interpolates templates", () => {
    expect(formatWhatsAppCampaignCode(42)).toBe("WC-0042");
    expect(formatWhatsAppLeadCode(7)).toBe("WA-0007");
    expect(
      renderWhatsAppTemplate("Hi {{name}} in {{city}}", { name: "Priya", city: "Whitefield" }),
    ).toBe("Hi Priya in Whitefield");
  });
});
