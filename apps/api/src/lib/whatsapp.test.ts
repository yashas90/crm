import { describe, expect, it } from "vitest";
import {
  buildTemplateComponents,
  extractTemplateVariables,
  extractWhatsAppInboundMessages,
  extractWhatsAppStatusUpdates,
  normalizeTemplateCategory,
  toWhatsAppRecipient,
} from "./whatsapp.js";

describe("toWhatsAppRecipient", () => {
  it("normalizes Indian 10-digit numbers", () => {
    expect(toWhatsAppRecipient("9876543210")).toBe("919876543210");
    expect(toWhatsAppRecipient("+91 98765 43210")).toBe("919876543210");
  });
});

describe("extractTemplateVariables", () => {
  it("extracts named and numbered placeholders", () => {
    expect(
      extractTemplateVariables([
        { type: "BODY", text: "Hi {{name}}, visit {{property}} on {{1}}" },
      ]),
    ).toEqual(["{{name}}", "{{property}}", "{{1}}"]);
  });
});

describe("buildTemplateComponents", () => {
  it("maps variable values to body parameters in order", () => {
    expect(
      buildTemplateComponents(["{{name}}", "{{property}}"], {
        name: "Priya",
        property: "Sunrise Heights",
      }),
    ).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Priya" },
          { type: "text", text: "Sunrise Heights" },
        ],
      },
    ]);
  });
});

describe("normalizeTemplateCategory", () => {
  it("maps Meta categories to internal values", () => {
    expect(normalizeTemplateCategory("MARKETING")).toBe("marketing");
    expect(normalizeTemplateCategory("UTILITY")).toBe("utility");
    expect(normalizeTemplateCategory("AUTHENTICATION")).toBe("authentication");
  });
});

describe("extractWhatsAppStatusUpdates", () => {
  it("parses delivery status webhook payloads", () => {
    const updates = extractWhatsAppStatusUpdates({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                statuses: [
                  {
                    id: "wamid.abc123",
                    status: "delivered",
                    timestamp: "1710000000",
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      waMessageId: "wamid.abc123",
      status: "delivered",
      timestamp: 1710000000,
    });
  });
});

describe("extractWhatsAppInboundMessages", () => {
  it("parses button replies and text", () => {
    const inbound = extractWhatsAppInboundMessages({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                contacts: [{ wa_id: "919876543210", profile: { name: "Priya" } }],
                messages: [
                  {
                    from: "919876543210",
                    id: "wamid.in.1",
                    timestamp: "1710000000",
                    type: "interactive",
                    interactive: {
                      type: "button_reply",
                      button_reply: { id: "interested", title: "I'm Interested" },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(inbound).toHaveLength(1);
    expect(inbound[0]).toMatchObject({
      from: "919876543210",
      buttonId: "interested",
      text: "I'm Interested",
      contactName: "Priya",
    });
  });
});
