import { describe, expect, it } from "vitest";
import {
  generateSiteVisitPublicToken,
  isValidSiteVisitPublicToken,
} from "./siteVisitPublicToken.js";

describe("siteVisitPublicToken", () => {
  it("generates SV-YYYY-XXXXXXXX tokens", () => {
    const token = generateSiteVisitPublicToken(new Date("2026-07-03T12:00:00Z"));
    expect(token).toMatch(/^SV-2026-[A-F0-9]{8}$/);
    expect(isValidSiteVisitPublicToken(token)).toBe(true);
  });

  it("rejects invalid tokens", () => {
    expect(isValidSiteVisitPublicToken("")).toBe(false);
    expect(isValidSiteVisitPublicToken("SV-2026-abc")).toBe(false);
    expect(isValidSiteVisitPublicToken("visit-uuid")).toBe(false);
  });
});
