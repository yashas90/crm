const NA_STATUSES = new Set(["not_interested", "dropped"]);

/** Status resolution for CSV bulk-import merges (mirrors assign applyNewStatus). */
export function resolveBulkImportLeadStatus(input: {
  existingStatus: string;
  csvStatus?: string;
  applyNewStatus: boolean;
}): { leadStatus?: string; clearNaFields?: boolean } {
  const shouldApplyNewStatus = input.applyNewStatus && NA_STATUSES.has(input.existingStatus);

  // "New status" preference wins over a CSV status column for dropped / not_interested.
  if (shouldApplyNewStatus) {
    return { leadStatus: "new", clearNaFields: true };
  }
  if (input.csvStatus !== undefined) {
    return { leadStatus: input.csvStatus };
  }
  if (input.existingStatus === "lost" || input.existingStatus === "won") {
    return { leadStatus: "new" };
  }
  return {};
}
