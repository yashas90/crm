import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { getMobileClientHeaders } from "@/lib/appVersion";
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
type AppUpdateRequiredHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let appUpdateRequiredHandler: AppUpdateRequiredHandler | null = null;
let sessionLogoutSuppressed = false;
let refreshPromise: Promise<boolean> | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function setAppUpdateRequiredHandler(handler: AppUpdateRequiredHandler | null) {
  appUpdateRequiredHandler = handler;
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
const RETRY_BASE_DELAY_MS = 800;
const RATE_LIMIT_RETRY_DELAY_MS = 1500;
const MAX_TRANSIENT_RETRIES = 1;
const REQUEST_TIMEOUT_MS = 45_000;
const JSON_READ_TIMEOUT_MS = 15_000;

const NETWORK_ERROR_MESSAGE = "Connection issue. Check your mobile data or Wi‑Fi and try again.";

const TIMEOUT_ERROR_MESSAGE =
  "The server took too long to respond. Pull down to refresh or try again in a moment.";

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

function abortError() {
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(abortError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function toNetworkError(err: unknown): ApiRequestError {
  const timedOut = err instanceof Error && err.name === "AbortError";
  return new ApiRequestError(
    "NETWORK_ERROR",
    timedOut ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE,
  );
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`${getApiUrl()}/api/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...getMobileClientHeaders(),
          },
          body: JSON.stringify({ refreshToken }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!response.ok) return false;
      const json = (await withTimeout(response.json(), JSON_READ_TIMEOUT_MS)) as
        | ApiSuccess<{
            token: string;
            refreshToken: string;
          }>
        | ApiError;
      if (!json.ok) return false;
      await updateTokens(json.data.token, json.data.refreshToken);
      return true;
    } catch (err) {
      // Network failure — do not treat as invalid session (caller keeps refresh token).
      throw toNetworkError(err);
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
    ...getMobileClientHeaders(),
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
    throw toNetworkError(err);
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

  let json: ApiSuccess<T> | ApiError;
  try {
    json = (await withTimeout(response.json(), JSON_READ_TIMEOUT_MS)) as ApiSuccess<T> | ApiError;
  } catch (err) {
    throw toNetworkError(err);
  }

  if (!response.ok || !json.ok) {
    const error = json.ok ? { code: "HTTP_ERROR", message: response.statusText } : json.error;
    const apiError = new ApiRequestError(
      error.code,
      error.message,
      "details" in error ? error.details : undefined,
      response.status,
    );

    if (apiError.code === "APP_UPDATE_REQUIRED" || response.status === 426) {
      appUpdateRequiredHandler?.();
    }

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
          : RETRY_BASE_DELAY_MS * (attempt + 1);
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
