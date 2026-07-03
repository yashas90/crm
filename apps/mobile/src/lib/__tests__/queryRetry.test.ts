import { ApiRequestError } from "@/lib/apiClient";
import { isTransientQueryError, queryRetryCount, queryRetryDelay } from "@/lib/queryRetry";

describe("queryRetry", () => {
  it("retries transient network errors up to 3 times", () => {
    const err = new ApiRequestError("NETWORK_ERROR", "offline");
    expect(isTransientQueryError(err)).toBe(true);
    expect(queryRetryCount(0, err)).toBe(true);
    expect(queryRetryCount(2, err)).toBe(true);
    expect(queryRetryCount(3, err)).toBe(false);
  });

  it("uses exponential backoff delays", () => {
    expect(queryRetryDelay(0)).toBe(1000);
    expect(queryRetryDelay(1)).toBe(2000);
    expect(queryRetryDelay(4)).toBe(8000);
  });
});
