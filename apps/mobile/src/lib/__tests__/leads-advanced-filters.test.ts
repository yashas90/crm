jest.mock("@/lib/auth", () => ({
  getCurrentUserId: jest.fn().mockReturnValue("user-99"),
}));

import { getCurrentUserId } from "@/lib/auth";
import {
  countActiveMobileLeadFilters,
  defaultMobileLeadFilters,
  mobileFiltersToApiParams,
} from "@/lib/leads-advanced-filters";

const mockGetCurrentUserId = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;

describe("defaultMobileLeadFilters", () => {
  it("returns scope all with empty status/source/temperature", () => {
    const f = defaultMobileLeadFilters();
    expect(f.scope).toBe("all");
    expect(f.status).toBe("");
    expect(f.source).toBe("");
    expect(f.temperature).toBe("");
  });
});

describe("countActiveMobileLeadFilters", () => {
  it("returns 0 for defaults", () => {
    expect(countActiveMobileLeadFilters(defaultMobileLeadFilters())).toBe(0);
  });

  it("counts scope change", () => {
    const f = { ...defaultMobileLeadFilters(), scope: "my" as const };
    expect(countActiveMobileLeadFilters(f)).toBe(1);
  });

  it("counts status filter", () => {
    const f = { ...defaultMobileLeadFilters(), status: "contacted" };
    expect(countActiveMobileLeadFilters(f)).toBe(1);
  });

  it("counts multiple active filters", () => {
    const f = {
      ...defaultMobileLeadFilters(),
      scope: "my" as const,
      status: "contacted",
      temperature: "hot",
    };
    expect(countActiveMobileLeadFilters(f)).toBe(3);
  });
});

describe("mobileFiltersToApiParams", () => {
  it("returns empty object for default filters", () => {
    const params = mobileFiltersToApiParams(defaultMobileLeadFilters());
    expect(params.status).toBeUndefined();
    expect(params.temperature).toBeUndefined();
    expect(params.assignedTo).toBeUndefined();
  });

  it("adds assignedTo=userId for my scope", () => {
    mockGetCurrentUserId.mockReturnValue("user-99");
    const f = { ...defaultMobileLeadFilters(), scope: "my" as const };
    const params = mobileFiltersToApiParams(f);
    expect(params.assignedTo).toBe("user-99");
  });

  it("adds unassigned=true for unassigned scope", () => {
    const f = { ...defaultMobileLeadFilters(), scope: "unassigned" as const };
    const params = mobileFiltersToApiParams(f);
    expect(params.unassigned).toBe("true");
  });

  it("adds teamLeads=true for teams scope", () => {
    const f = { ...defaultMobileLeadFilters(), scope: "teams" as const };
    const params = mobileFiltersToApiParams(f);
    expect(params.teamLeads).toBe("true");
  });

  it("passes status, source, temperature directly", () => {
    const f = {
      ...defaultMobileLeadFilters(),
      status: "contacted",
      source: "website",
      temperature: "hot",
    };
    const params = mobileFiltersToApiParams(f);
    expect(params.status).toBe("contacted");
    expect(params.source).toBe("website");
    expect(params.temperature).toBe("hot");
  });
});
