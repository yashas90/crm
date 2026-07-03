import { describe, expect, it } from "vitest";
import { DEFAULT_ORG_CURRENCY, DEFAULT_ORG_LOCALE, resolveOrgFormatting } from "./org-settings";

describe("org-settings", () => {
  it("uses defaults when settings are empty", () => {
    expect(resolveOrgFormatting({})).toEqual({
      locale: DEFAULT_ORG_LOCALE,
      currency: DEFAULT_ORG_CURRENCY,
      dateFormat: "DD/MM/YYYY",
      timezone: "Asia/Kolkata",
    });
  });

  it("reads configured regional values", () => {
    expect(
      resolveOrgFormatting({
        locale: "en-US",
        currency: "USD",
        dateFormat: "MM/DD/YYYY",
        timezone: "America/New_York",
      }),
    ).toEqual({
      locale: "en-US",
      currency: "USD",
      dateFormat: "MM/DD/YYYY",
      timezone: "America/New_York",
    });
  });
});
