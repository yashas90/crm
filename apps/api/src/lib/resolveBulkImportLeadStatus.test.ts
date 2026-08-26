import { describe, expect, it } from "vitest";
import { resolveBulkImportLeadStatus } from "./resolveBulkImportLeadStatus.js";

describe("resolveBulkImportLeadStatus", () => {
  it("forces dropped → new when applyNewStatus is on, even if CSV says dropped", () => {
    expect(
      resolveBulkImportLeadStatus({
        existingStatus: "dropped",
        csvStatus: "dropped",
        applyNewStatus: true,
      }),
    ).toEqual({ leadStatus: "new", clearNaFields: true, refreshNewWindow: true });
  });

  it("forces not_interested → new when applyNewStatus is on", () => {
    expect(
      resolveBulkImportLeadStatus({
        existingStatus: "not_interested",
        csvStatus: "not_interested",
        applyNewStatus: true,
      }),
    ).toEqual({ leadStatus: "new", clearNaFields: true, refreshNewWindow: true });
  });

  it("forces Pending (contacted) → new when applyNewStatus is on", () => {
    expect(
      resolveBulkImportLeadStatus({
        existingStatus: "contacted",
        csvStatus: undefined,
        applyNewStatus: true,
      }),
    ).toEqual({ leadStatus: "new", clearNaFields: true, refreshNewWindow: true });
  });

  it("keeps CSV status when applyNewStatus is off", () => {
    expect(
      resolveBulkImportLeadStatus({
        existingStatus: "dropped",
        csvStatus: "dropped",
        applyNewStatus: false,
      }),
    ).toEqual({ leadStatus: "dropped" });
  });

  it("does not force new for qualified when applyNewStatus is on", () => {
    expect(
      resolveBulkImportLeadStatus({
        existingStatus: "qualified",
        csvStatus: undefined,
        applyNewStatus: true,
      }),
    ).toEqual({});
  });
});
