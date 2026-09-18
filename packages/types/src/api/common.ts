export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
};

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
  meta?: PaginationMeta;
};

export type ApiErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.ok;
}

export function isApiError<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return !response.ok;
}

export type ApiErrorFields = {
  code: string;
  message: string;
  details?: unknown;
};

export type HttpErrorContext = {
  ok: boolean;
  status: number;
  statusText: string;
};

/** Shown when a gateway (e.g. Railway) returns a body without our `{ ok, error }` envelope. */
export const API_UNAVAILABLE_MESSAGE =
  "The API server is unreachable. Confirm the Railway service is running and the API URL is current.";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isGatewayUnavailableMessage(message: string): boolean {
  return /application not found/i.test(message) || /application failed to respond/i.test(message);
}

/**
 * Map any JSON error body to `{ code, message }` without throwing.
 * Railway fallbacks look like `{ status: "error", code: 404, message: "Application not found" }`
 * and have no nested `error` object — the web client used to crash on `error.code`.
 */
export function resolveApiErrorFields(json: unknown, http: HttpErrorContext): ApiErrorFields {
  if (isPlainObject(json) && json.ok === true) {
    return {
      code: "HTTP_ERROR",
      message: http.statusText || `Request failed (${http.status})`,
    };
  }

  if (isPlainObject(json) && isPlainObject(json.error)) {
    const nested = json.error;
    const code = typeof nested.code === "string" && nested.code.trim() ? nested.code : "HTTP_ERROR";
    const message =
      typeof nested.message === "string" && nested.message.trim()
        ? nested.message
        : http.statusText || "Request failed";
    return { code, message, details: nested.details };
  }

  if (isPlainObject(json) && typeof json.message === "string" && json.message.trim()) {
    return {
      code: http.status === 404 || http.status >= 500 ? "API_UNAVAILABLE" : "HTTP_ERROR",
      message: isGatewayUnavailableMessage(json.message) ? API_UNAVAILABLE_MESSAGE : json.message,
    };
  }

  return {
    code: http.status === 404 || http.status >= 500 ? "API_UNAVAILABLE" : "HTTP_ERROR",
    message: http.statusText || `Request failed (${http.status})`,
  };
}
