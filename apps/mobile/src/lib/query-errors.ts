import { ApiRequestError } from "@/lib/apiClient";

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 403 || error.code === "FORBIDDEN");
}
