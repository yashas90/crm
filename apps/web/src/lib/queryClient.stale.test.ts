import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();

vi.mock("@/lib/toast", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

describe("web queryClient stale-data handling", () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it("does not toast when a query refetch fails but cached data exists", async () => {
    const { makeQueryClient } = await import("./queryClient");
    const client = makeQueryClient();
    const cache = client.getQueryCache();
    const query = cache.build(client, {
      queryKey: ["leads", "stale"],
      queryFn: async () => ({ items: [] }),
    });
    query.setState({ data: { items: [] }, dataUpdateCount: 1, status: "success" });

    cache.config.onError?.(new Error("refresh failed"), query);
    await Promise.resolve();

    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts once for an initial load failure with no cached data", async () => {
    const { makeQueryClient } = await import("./queryClient");
    const client = makeQueryClient();
    const queryCache = client.getQueryCache();
    const query = queryCache.build(client, {
      queryKey: ["leads", "empty"],
      queryFn: async () => {
        throw new Error("boom");
      },
    });

    queryCache.config.onError?.(new Error("boom"), query);
    queryCache.config.onError?.(new Error("boom"), query);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
