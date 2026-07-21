import { describe, expect, it } from "vitest";
import { leadTabCountsQueryKey, leadsListQueryKey } from "./use-leads";

describe("leads query keys include advanced filters", () => {
  it("changes list query key when an advanced filter changes", () => {
    const base = {
      activeOnly: "true",
      excludeDuplicates: "true",
      importBatchId: "batch-1",
      page: "1",
      pageSize: "10",
    };

    const withoutCity = leadsListQueryKey(base);
    const withCity = leadsListQueryKey({ ...base, city: "Mumbai" });

    expect(withoutCity).not.toEqual(withCity);
  });

  it("changes tab-counts query key when scope assignment changes", () => {
    const shared = {
      importBatchId: "batch-1",
      excludeDuplicates: "true",
    };

    const allScope = leadTabCountsQueryKey(shared);
    const myScope = leadTabCountsQueryKey({ ...shared, assignedTo: "user-1" });

    expect(allScope).not.toEqual(myScope);
  });
});
