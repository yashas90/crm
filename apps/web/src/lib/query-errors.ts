import { ApiRequestError } from "@/lib/apiClient";

/** True when the API returned a 403 FORBIDDEN error. */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === "FORBIDDEN";
}
