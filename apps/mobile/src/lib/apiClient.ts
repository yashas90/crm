import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { getToken } from "@/lib/auth";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let sessionLogoutSuppressed = false;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

/** Suppress automatic logout on 401 (bootstrap / best-effort requests). */
export function runWithSessionLogoutSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  sessionLogoutSuppressed = true;
  return fn().finally(() => {
    sessionLogoutSuppressed = false;
  });
}

export type ApiRequestOptions = {
  skipSessionLogout?: boolean;
};

/** Resolved at request time (not module load) for correct release/dev URLs. */
export function getApiUrl() {
  return getApiBaseUrl();
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & ApiRequestOptions,
): Promise<T> {
  const { skipSessionLogout, ...requestInit } = init ?? {};
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(requestInit.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${getApiUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(url, { ...requestInit, headers });
  } catch {
    throw new ApiRequestError(
      "NETWORK_ERROR",
      "Cannot reach the server. Check your internet connection and try again.",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      response.ok
        ? "Unexpected server response."
        : `Server error (${response.status}). Try again later.`,
    );
  }

  const json = (await response.json()) as ApiSuccess<T> | ApiError;

  if (!response.ok || !json.ok) {
    const error = json.ok ? { code: "HTTP_ERROR", message: response.statusText } : json.error;
    const apiError = new ApiRequestError(
      error.code,
      error.message,
      "details" in error ? error.details : undefined,
      response.status,
    );

    if (
      !skipSessionLogout &&
      !sessionLogoutSuppressed &&
      (response.status === 401 || error.code === "UNAUTHORIZED" || error.code === "INVALID_TOKEN")
    ) {
      unauthorizedHandler?.();
    }

    throw apiError;
  }

  return json.data;
}

export function apiGet<T>(path: string, options?: ApiRequestOptions) {
  return apiFetch<T>(path, { method: "GET", ...options });
}

export function apiPost<T>(path: string, body: unknown, options?: ApiRequestOptions) {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

export function apiPatch<T>(path: string, body: unknown, options?: ApiRequestOptions) {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
    ...options,
  });
}
