import { ApiRequestError } from "@/lib/apiClient";
import { isTransientQueryError, queryRetryCount, queryRetryDelay } from "@/lib/queryRetry";

describe("queryRetry", () => {
  it("retries transient network errors once", () => {
    const err = new ApiRequestError("NETWORK_ERROR", "offline");
    expect(isTransientQueryError(err)).toBe(true);
    expect(queryRetryCount(0, err)).toBe(true);
    expect(queryRetryCount(1, err)).toBe(false);
  });

  it("uses exponential backoff delays", () => {
    expect(queryRetryDelay(0)).toBe(1000);
    expect(queryRetryDelay(1)).toBe(2000);
    expect(queryRetryDelay(4)).toBe(8000);
  });
});
