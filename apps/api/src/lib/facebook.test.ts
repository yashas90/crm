import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  coerceMetaWebhookNumericIds,
  extractLeadgenChanges,
  mapFacebookLeadToNormalizedAdLead,
  verifyMetaWebhookSignature,
} from "./facebook.js";

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

describe("extractLeadgenChanges", () => {
  it("stringifies numeric Meta IDs and fills page_id from entry.id", () => {
    const changes = extractLeadgenChanges({
      object: "page",
      entry: [
        {
          id: 111222333 as unknown as string,
          changes: [
            {
              field: "leadgen",
              value: {
                leadgen_id: 444555666777 as unknown as string,
                page_id: undefined as unknown as string,
                form_id: 888999000 as unknown as string,
              },
            },
          ],
        },
      ],
    });

    expect(changes).toEqual([
      {
        leadgen_id: "444555666777",
        page_id: "111222333",
        form_id: "888999000",
        ad_id: undefined,
        adgroup_id: undefined,
        campaign_id: undefined,
        created_time: undefined,
      },
    ]);
  });
});

describe("coerceMetaWebhookNumericIds", () => {
  it("quotes long numeric IDs so JSON.parse keeps full precision", () => {
    const raw = '{"value":{"leadgen_id":12345678901234567,"page_id":111222333444}}';
    const parsed = JSON.parse(coerceMetaWebhookNumericIds(raw)) as {
      value: { leadgen_id: string; page_id: string };
    };
    expect(parsed.value.leadgen_id).toBe("12345678901234567");
    expect(parsed.value.page_id).toBe("111222333444");
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
