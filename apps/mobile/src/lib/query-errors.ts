import { ApiRequestError } from "@/lib/apiClient";

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 403 || error.code === "FORBIDDEN");
}

/** Rate limit / IP block — avoid alert spam when many queries fail at once. */
export function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    (error.code === "RATE_LIMITED" || error.code === "IP_BLOCKED" || error.status === 429)
  );
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === "NETWORK_ERROR";
}

export { isTransientQueryError } from "@/lib/queryRetry";

export function queryErrorMessage(error: unknown, fallback = "We couldn't load this data.") {
  if (error instanceof ApiRequestError) {
    if (error.code === "NETWORK_ERROR") {
      return "Connection issue. Check your signal and try again.";
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
