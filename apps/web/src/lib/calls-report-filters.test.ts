import { addDaysToDateKey, istWallClockToDate } from "@propninja/types/ist";
import { describe, expect, it } from "vitest";
import {
  callsReportFiltersToApiRange,
  callsReportFiltersToQueryParams,
  defaultCallsReportFilters,
} from "./calls-report-filters";

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

  it("bounds a selected calendar day in IST", () => {
    const range = callsReportFiltersToApiRange({
      ...defaultCallsReportFilters(),
      datePreset: "custom",
      dateFrom: "2026-10-15",
      dateTo: "2026-10-15",
    });
    const end = new Date(istWallClockToDate(addDaysToDateKey("2026-10-15", 1), 0, 0).getTime() - 1);
    expect(range.dateFrom).toBe(istWallClockToDate("2026-10-15", 0, 0).toISOString());
    expect(range.dateTo).toBe(end.toISOString());
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
