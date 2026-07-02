import { ApiRequestError } from "@/lib/apiClient";

/** True when the API returned a 403 FORBIDDEN error. */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === "FORBIDDEN";
}

/** Rate limit / IP block — avoid toast spam when many queries fail at once. */
export function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    (error.code === "RATE_LIMITED" || error.code === "IP_BLOCKED")
  );
}
