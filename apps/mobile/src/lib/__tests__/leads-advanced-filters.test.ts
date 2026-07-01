jest.mock("@/lib/auth", () => ({
  getCurrentUserId: jest.fn().mockReturnValue("user-99"),
  getUser: jest.fn().mockReturnValue({ role: "manager" }),
  normalizeRole: (role: string) => role,
}));

import { getCurrentUserId, getUser } from "@/lib/auth";
import {
  countActiveMobileLeadFilters,
  defaultMobileLeadFilters,
  mobileFiltersToApiParams,
} from "@/lib/leads-advanced-filters";

const mockGetCurrentUserId = getCurrentUserId as jest.MockedFunction<typeof getCurrentUserId>;
const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;

describe("defaultMobileLeadFilters", () => {
  it("returns scope all with empty status/source/temperature for managers", () => {
    const f = defaultMobileLeadFilters();
    expect(f.scope).toBe("all");
    expect(f.status).toBe("");
    expect(f.source).toBe("");
    expect(f.temperature).toBe("");
  });

  it("defaults agents to my scope", () => {
    const f = defaultMobileLeadFilters(true);
    expect(f.scope).toBe("my");
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

  it("does not count my scope as active for agents", () => {
    const f = defaultMobileLeadFilters(true);
    expect(countActiveMobileLeadFilters(f, { isAgent: true })).toBe(0);
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

  it("forces assignedTo and strips cross-book flags for agents", () => {
    mockGetUser.mockReturnValue({ role: "agent" } as ReturnType<typeof getUser>);
    mockGetCurrentUserId.mockReturnValue("user-99");
    const f = { ...defaultMobileLeadFilters(true), scope: "unassigned" as const };
    const params = mobileFiltersToApiParams(f);
    expect(params.assignedTo).toBe("user-99");
    expect(params.unassigned).toBeUndefined();
    expect(params.teamLeads).toBeUndefined();
  });
});
