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
