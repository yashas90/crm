import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refetchAllLeadQueries } from "./use-leads";

describe("refetchAllLeadQueries", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates active lead queries once without a second refetch pass", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined as never);
    const refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue([] as never);

    await refetchAllLeadQueries(queryClient);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leads"], refetchType: "active" });
    expect(refetch).not.toHaveBeenCalled();
  });
});
