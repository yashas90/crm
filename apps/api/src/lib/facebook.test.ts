import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapFacebookLeadToNormalizedAdLead, verifyMetaWebhookSignature } from "./facebook.js";

function signBody(rawBody: string, secret: string) {
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
}

describe("mapFacebookLeadToNormalizedAdLead", () => {
  it("maps standard Meta lead form fields", () => {
    const mapped = mapFacebookLeadToNormalizedAdLead(
      "leadgen-1",
      {
        field_data: [
          { name: "full_name", values: ["Ravi Kumar"] },
          { name: "phone_number", values: ["9876543210"] },
          { name: "email", values: ["ravi@example.com"] },
          { name: "ad_name", values: ["Luxury Villas"] },
        ],
      },
      { leadgen_id: "leadgen-1", page_id: "page-1", ad_id: "ad-55" },
    );

    expect(mapped).toMatchObject({
      source: "facebook_ads",
      externalLeadId: "leadgen-1",
      fullName: "Ravi Kumar",
      phone: "9876543210",
      email: "ravi@example.com",
      adName: "Luxury Villas",
      adId: "ad-55",
    });
  });
});

describe("verifyMetaWebhookSignature", () => {
  const secret = "test-app-secret";
  const body = JSON.stringify({ object: "page", entry: [] });

  it("accepts a valid signature", () => {
    expect(verifyMetaWebhookSignature(body, signBody(body, secret), secret)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(verifyMetaWebhookSignature(body, undefined, secret)).toBe(false);
  });

  it("rejects a tampered body", () => {
    expect(verifyMetaWebhookSignature(`${body} `, signBody(body, secret), secret)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyMetaWebhookSignature(body, signBody(body, "other-secret"), secret)).toBe(false);
  });
});
