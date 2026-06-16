import { describe, expect, it } from "vitest";
import { buildLeadsSearchParams, parseLeadsPageUrl } from "./leads-url-filters";

describe("leads URL filters", () => {
  it("round-trips ad leads filter", () => {
    const params = new URLSearchParams("ad_leads=true&scope=all&active=true");
    const parsed = parseLeadsPageUrl(params);
    expect(parsed.filters.adLeadsOnly).toBe(true);

    const serialized = buildLeadsSearchParams(parsed.filters, {
      scope: parsed.scope,
      stage: parsed.stage,
    });
    expect(serialized).toContain("ad_leads=true");
  });

  it("round-trips Facebook Ads source filter", () => {
    const params = new URLSearchParams("source=Facebook%20Ads&active=true");
    const parsed = parseLeadsPageUrl(params);
    expect(parsed.filters.source).toBe("Facebook Ads");

    const serialized = buildLeadsSearchParams(parsed.filters, {
      scope: parsed.scope,
      stage: parsed.stage,
    });
    expect(serialized).toContain("source=Facebook+Ads");
  });

  it("round-trips tags filter", () => {
    const params = new URLSearchParams("tags=hot%2Cvip&active=true");
    const parsed = parseLeadsPageUrl(params);
    expect(parsed.filters.tags).toBe("hot,vip");

    const serialized = buildLeadsSearchParams(parsed.filters, {
      scope: parsed.scope,
      stage: parsed.stage,
    });
    expect(serialized).toContain("tags=hot%2Cvip");
  });

  it("writes scope to the URL", () => {
    const query = buildLeadsSearchParams(
      { ...parseLeadsPageUrl(new URLSearchParams()).filters, adLeadsOnly: false },
      { scope: "deleted", stage: "active" },
    );
    expect(query).toContain("scope=deleted");
    expect(query).toContain("active=true");
  });
});
