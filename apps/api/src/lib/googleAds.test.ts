import { describe, expect, it } from "vitest";
import { mapGoogleAdsSearchRow } from "./googleAds.js";

describe("mapGoogleAdsSearchRow", () => {
  it("maps lead form submission fields into a normalized submission", () => {
    const mapped = mapGoogleAdsSearchRow({
      leadFormSubmissionData: {
        id: "12345",
        resourceName: "customers/1/leadFormSubmissionData/12345",
        submissionDateTime: "2026-06-05 10:30:00",
        asset: "customers/1/assets/99",
        leadFormSubmissionFields: [
          { fieldType: "FULL_NAME", fieldValue: "Jane Doe" },
          { fieldType: "EMAIL", fieldValue: "jane@example.com" },
          { fieldType: "PHONE_NUMBER", fieldValue: "+919876543210" },
          { fieldType: "CITY", fieldValue: "Mumbai" },
        ],
      },
      campaign: { id: "111", name: "Summer Campaign" },
      adGroup: { id: "222", name: "Search Ad Group" },
      asset: {
        resourceName: "customers/1/assets/99",
        name: "Contact Form - Summer",
        leadFormAsset: { businessName: "Acme Realty" },
      },
    });

    expect(mapped).toEqual({
      externalLeadId: "12345",
      campaignId: "111",
      campaignName: "Summer Campaign",
      adsetId: "222",
      adsetName: "Search Ad Group",
      formId: "99",
      formName: "Contact Form - Summer",
      fullName: "Jane Doe",
      firstName: undefined,
      lastName: undefined,
      email: "jane@example.com",
      phone: "+919876543210",
      city: "Mumbai",
      submittedAt: "2026-06-05 10:30:00",
      rawPayload: expect.any(Object),
    });
  });
});
