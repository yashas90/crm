const APPLY_NEW_FROM = new Set(["not_interested", "dropped", "contacted", "new"]);

/** Status resolution for CSV bulk-import merges (mirrors assign applyNewStatus). */
export function resolveBulkImportLeadStatus(input: {
  existingStatus: string;
  csvStatus?: string;
  applyNewStatus: boolean;
}): { leadStatus?: string; clearNaFields?: boolean; refreshNewWindow?: boolean } {
  const shouldApplyNewStatus = input.applyNewStatus && APPLY_NEW_FROM.has(input.existingStatus);

  // "New status" preference wins — Pending / NA / stale New → New for the assignee.
  if (shouldApplyNewStatus) {
    return {
      leadStatus: "new",
      clearNaFields: true,
      refreshNewWindow: true,
    };
  }
  if (input.csvStatus !== undefined) {
    return { leadStatus: input.csvStatus };
  }
  if (input.existingStatus === "lost" || input.existingStatus === "won") {
    return { leadStatus: "new", refreshNewWindow: true };
  }
  return {};
}
