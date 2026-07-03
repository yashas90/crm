import { ApiRequestError } from "@/lib/apiClient";

const MAX_QUERY_RETRIES = 3;

export function isTransientQueryError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false;
  if (error.code === "NETWORK_ERROR" || error.code === "INVALID_RESPONSE") return true;
  if (error.code === "RATE_LIMITED" || error.code === "IP_BLOCKED" || error.status === 429) {
    return true;
  }
  if (error.status === 502 || error.status === 503 || error.status === 504) return true;
  return false;
}

export function queryRetryCount(failureCount: number, error: unknown): boolean {
  if (!isTransientQueryError(error)) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

export function queryRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 8000);
}
