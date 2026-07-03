import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { clearAuth, getRefreshToken, getToken, updateTokens } from "@/lib/auth";

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
let refreshPromise: Promise<boolean> | null = null;

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

/** End the session in React state (logout) or clear storage only during bootstrap. */
export function invalidateSession() {
  if (sessionLogoutSuppressed) {
    void clearAuth();
    return;
  }
  unauthorizedHandler?.();
}

export type ApiRequestOptions = {
  skipSessionLogout?: boolean;
  skipOfflineQueue?: boolean;
  /** Do not auto-retry transient errors (use for login — avoids multiplying rate-limit hits). */
  skipTransientRetry?: boolean;
};

export class QueuedOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueuedOfflineError";
  }
}

export function isQueuedOfflineError(err: unknown): err is QueuedOfflineError {
  return err instanceof QueuedOfflineError;
}

/** Resolved at request time (not module load) for correct release/dev URLs. */
export function getApiUrl() {
  return getApiBaseUrl();
}

const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAY_MS = 600;
const RATE_LIMIT_RETRY_DELAY_MS = 1500;
const MAX_TRANSIENT_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 30_000;

const NETWORK_ERROR_MESSAGE =
  "Cannot reach the server. Check your mobile data or Wi‑Fi. If you recently updated the CRM, uninstall this app and install the latest APK from your admin.";

function isTransientFailure(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false;
  if (error.code === "NETWORK_ERROR" || error.code === "INVALID_RESPONSE") return true;
  if (error.code === "RATE_LIMITED" || error.code === "IP_BLOCKED" || error.status === 429) {
    return true;
  }
  return error.status !== undefined && TRANSIENT_HTTP_STATUSES.has(error.status);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const json = (await response.json()) as
        | ApiSuccess<{
            token: string;
            refreshToken: string;
          }>
        | ApiError;
      if (!json.ok) return false;
      await updateTokens(json.data.token, json.data.refreshToken);
      return true;
    } catch {
      // Network failure — do not treat as invalid session (caller keeps refresh token).
      throw new ApiRequestError("NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function apiFetchOnce<T>(path: string, init: RequestInit & ApiRequestOptions): Promise<T> {
  const { skipSessionLogout, ...requestInit } = init;
  const token = getToken();
  const method = (requestInit.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(requestInit.headers as Record<string, string> | undefined),
  };
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    headers["X-Requested-With"] = "XMLHttpRequest";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${getApiUrl()}${path}`;
  let response: Response;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    response = await fetch(url, { ...requestInit, headers, signal: controller.signal });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    throw new ApiRequestError(
      "NETWORK_ERROR",
      timedOut
        ? "The server took too long to respond. Check your connection and try again."
        : NETWORK_ERROR_MESSAGE,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      response.ok
        ? "Unexpected server response."
        : `Server error (${response.status}). Try again later.`,
      undefined,
      response.status,
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

    // Session logout is handled in apiFetch after a failed token refresh — not here on every 401.

    throw apiError;
  }

  return json.data;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & ApiRequestOptions,
): Promise<T> {
  const options = init ?? {};
  let attempt = 0;

  while (true) {
    try {
      return await apiFetchOnce<T>(path, options);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 401 &&
        path !== "/api/auth/login" &&
        path !== "/api/auth/refresh" &&
        !options.skipSessionLogout
      ) {
        try {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return apiFetchOnce<T>(path, options);
          }
        } catch (refreshErr) {
          if (refreshErr instanceof ApiRequestError && refreshErr.code === "NETWORK_ERROR") {
            throw refreshErr;
          }
        }
        if (!sessionLogoutSuppressed) {
          unauthorizedHandler?.();
        }
      }

      if (
        !isTransientFailure(error) ||
        attempt >= MAX_TRANSIENT_RETRIES ||
        options.skipTransientRetry
      ) {
        throw error;
      }

      const delay =
        error instanceof ApiRequestError &&
        (error.code === "RATE_LIMITED" || error.code === "IP_BLOCKED" || error.status === 429)
          ? RATE_LIMIT_RETRY_DELAY_MS * (attempt + 1)
          : RETRY_DELAY_MS;
      attempt += 1;
      await sleep(delay);
    }
  }
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

export function apiDelete<T>(path: string, options?: ApiRequestOptions) {
  return apiFetch<T>(path, { method: "DELETE", ...options });
}
