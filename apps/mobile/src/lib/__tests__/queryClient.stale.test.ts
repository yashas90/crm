import { QueryCache, QueryClient } from "@tanstack/react-query";

describe("mobile queryClient stale-data handling", () => {
  it("does not alert when a query refetch fails but cached data exists", () => {
    const alertSpy = jest.fn();
    const cache = new QueryCache({
      onError: (error, query) => {
        if (query.state.data !== undefined) return;
        const message = error instanceof Error ? error.message : "Something went wrong";
        alertSpy("Could not load data", message);
      },
    });
    const client = new QueryClient({ queryCache: cache });

    const query = cache.build(client, {
      queryKey: ["leads", "stale"],
      queryFn: async () => ({ items: [] }),
    });
    query.setState({ data: { items: [] }, dataUpdateCount: 1, status: "success" });

    cache.config.onError?.(new Error("offline"), query);

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("alerts when the initial load fails with no cached data", () => {
    const alertSpy = jest.fn();
    const cache = new QueryCache({
      onError: (error, query) => {
        if (query.state.data !== undefined) return;
        const message = error instanceof Error ? error.message : "Something went wrong";
        alertSpy("Could not load data", message);
      },
    });
    const client = new QueryClient({ queryCache: cache });
    const query = cache.build(client, {
      queryKey: ["leads", "empty"],
      queryFn: async () => {
        throw new Error("boom");
      },
    });

    cache.config.onError?.(new Error("boom"), query);

    expect(alertSpy).toHaveBeenCalledWith("Could not load data", "boom");
  });
});
