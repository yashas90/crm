import { describe, expect, it } from "vitest";
import {
  buildLeadsSearchParams,
  defaultLeadsUrlFilters,
  leadsBaseFiltersToQuery,
  leadsFiltersToQuery,
  parseLeadsPageUrl,
  postImportLeadsFilters,
} from "./leads-url-filters";

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

  it("round-trips Meta Ads source filter (legacy Facebook Ads URL)", () => {
    const params = new URLSearchParams("source=Facebook%20Ads&active=true");
    const parsed = parseLeadsPageUrl(params);
    expect(parsed.filters.source).toBe("Meta Ads");

    const serialized = buildLeadsSearchParams(parsed.filters, {
      scope: parsed.scope,
      stage: parsed.stage,
    });
    expect(serialized).toContain("source=Meta+Ads");
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

  it("writes scope to the URL without stage params for bucket scopes", () => {
    const query = buildLeadsSearchParams(
      { ...parseLeadsPageUrl(new URLSearchParams()).filters, adLeadsOnly: false },
      { scope: "deleted", stage: "active" },
    );
    expect(query).toContain("scope=deleted");
    expect(query).not.toContain("active=true");
  });

  it("parses NA leads scope from URL", () => {
    const parsed = parseLeadsPageUrl(new URLSearchParams("scope=naleads"));
    expect(parsed.scope).toBe("naleads");
  });

  it("omits active stage filter for NA leads scope", () => {
    const query = buildLeadsSearchParams(defaultLeadsUrlFilters(), {
      scope: "naleads",
      stage: "active",
    });
    expect(query).toContain("scope=naleads");
    expect(query).not.toContain("active=true");

    const apiQuery = leadsFiltersToQuery(defaultLeadsUrlFilters(), {
      scope: "naleads",
      stage: "active",
    });
    expect(apiQuery.naLeadsOnly).toBe("true");
    expect(apiQuery.activeOnly).toBeUndefined();
  });

  it("includes active stage filter for unassigned scope (pipeline unassigned)", () => {
    const query = buildLeadsSearchParams(defaultLeadsUrlFilters(), {
      scope: "unassigned",
      stage: "active",
    });
    expect(query).toContain("scope=unassigned");
    expect(query).toContain("active=true");

    const apiQuery = leadsFiltersToQuery(defaultLeadsUrlFilters(), {
      scope: "unassigned",
      stage: "active",
    });
    expect(apiQuery.unassigned).toBe("true");
    expect(apiQuery.activeOnly).toBe("true");
  });

  it("post-import filters clear source and set batch id", () => {
    const filters = postImportLeadsFilters({ batchId: "batch-1", fileName: "leads.csv" });
    expect(filters.source).toBe("");
    expect(filters.adLeadsOnly).toBe(false);
    expect(filters.importBatchId).toBe("batch-1");
    expect(filters.importBatchLabel).toBe("leads.csv");

    const query = buildLeadsSearchParams(filters, { scope: "all", stage: "active" });
    expect(query).toContain("import_batch=batch-1");
    expect(query).not.toContain("source=");
  });

  it("includes scope assignment fields in base query for count parity", () => {
    const query = leadsBaseFiltersToQuery(defaultLeadsUrlFilters(), {
      scope: "my",
      userId: "user-1",
    });
    expect(query.assignedTo).toBe("user-1");
    expect(query.excludeDuplicates).toBe("true");
  });
});
