import { describe, expect, it } from "vitest";
import { callsReportFiltersToQueryParams } from "./calls-report-filters";

describe("calls report filters", () => {
  it("includes withTeam in API query params when enabled", () => {
    expect(
      callsReportFiltersToQueryParams({
        userIds: ["11111111-1111-4111-8111-111111111111"],
        withTeam: true,
        source: "",
        subSource: "",
        projectStatus: "",
        projectName: "",
        campaignName: "",
        datePreset: "last7",
      }),
    ).toEqual({
      userIds: ["11111111-1111-4111-8111-111111111111"],
      withTeam: true,
      source: undefined,
      subSource: undefined,
      projectName: undefined,
      projectStatus: undefined,
      campaignName: undefined,
    });
  });

  it("omits withTeam when disabled", () => {
    expect(
      callsReportFiltersToQueryParams({
        userIds: [],
        withTeam: false,
        source: "",
        subSource: "",
        projectStatus: "",
        projectName: "",
        campaignName: "",
        datePreset: "last7",
      }).withTeam,
    ).toBeUndefined();
  });
});
