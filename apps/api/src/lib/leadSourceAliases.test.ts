import { describe, expect, it } from "vitest";
import {
  canonicalizeLeadSource,
  expandLeadSourceFilter,
  leadSourceLowerVariants,
} from "./leadSourceAliases.js";

describe("expandLeadSourceFilter", () => {
  it("expands Meta Ads to canonical and legacy values", () => {
    const meta = expandLeadSourceFilter("Meta Ads");
    expect(meta).toContain("Meta Ads");
    expect(meta).toContain("Facebook Ads");
    expect(meta).toContain("facebook");
    expect(meta).toContain("Facebook");
    expect(meta).toContain("Facebook / Meta");
    expect(meta).toContain("Meta");
    expect(meta).toContain("fb");
  });

  it("resolves Facebook / Meta chip label and FB shorthand case-insensitively", () => {
    expect(expandLeadSourceFilter("Facebook / Meta")).toEqual(expandLeadSourceFilter("Meta Ads"));
    expect(expandLeadSourceFilter("FACEBOOK ADS")).toEqual(expandLeadSourceFilter("Meta Ads"));
    expect(expandLeadSourceFilter("Fb")).toEqual(expandLeadSourceFilter("Meta Ads"));
  });

  it("expands Google Ads aliases", () => {
    const google = expandLeadSourceFilter("google-ads");
    expect(google).toContain("Google Ads");
    expect(google).toContain("google-ads");
    expect(google).toContain("google");
  });

  it("expands Cold Call aliases including underscore form", () => {
    expect(expandLeadSourceFilter("cold_call")).toEqual(expandLeadSourceFilter("Cold Call"));
  });

  it("returns unknown sources unchanged", () => {
    expect(expandLeadSourceFilter("Billboard")).toEqual(["Billboard"]);
  });
});

describe("canonicalizeLeadSource", () => {
  it("maps legacy Meta variants to Meta Ads", () => {
    expect(canonicalizeLeadSource("facebook")).toBe("Meta Ads");
    expect(canonicalizeLeadSource("Facebook / Meta")).toBe("Meta Ads");
    expect(canonicalizeLeadSource("FB")).toBe("Meta Ads");
    expect(canonicalizeLeadSource("Meta Ads")).toBe("Meta Ads");
  });

  it("returns null for empty", () => {
    expect(canonicalizeLeadSource(null)).toBeNull();
    expect(canonicalizeLeadSource("  ")).toBeNull();
  });
});

describe("leadSourceLowerVariants", () => {
  it("dedupes case variants for SQL lower() IN", () => {
    const lower = leadSourceLowerVariants("Meta Ads");
    expect(lower).toContain("meta ads");
    expect(lower).toContain("facebook");
    expect(lower).toContain("facebook / meta");
    expect(lower).toContain("fb");
    expect(new Set(lower).size).toBe(lower.length);
  });
});
