import { getToken } from "@/lib/auth";

let cachedApiUrl: string | undefined;

function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (process.env.NODE_ENV === "production") {
    if (!configured || configured.includes("localhost")) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be set to a non-localhost URL in production. Configure it in Vercel before building.",
      );
    }
    return configured.replace(/\/$/, "");
  }

  return configured?.replace(/\/$/, "") ?? "http://localhost:3001";
}

function getApiUrl(): string {
  if (!cachedApiUrl) {
    cachedApiUrl = resolveApiUrl();
  }
  return cachedApiUrl;
}

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
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiRequestError(
      "NETWORK_ERROR",
      "Unable to reach the server. Check your connection and API URL.",
    );
  }

  const raw = await response.text();
  let json: ApiSuccess<T> | ApiError;
  try {
    json = raw
      ? (JSON.parse(raw) as ApiSuccess<T> | ApiError)
      : {
          ok: false,
          error: { code: "HTTP_ERROR", message: response.statusText || "Request failed" },
        };
  } catch {
    throw new ApiRequestError(
      "PARSE_ERROR",
      response.ok ? "Invalid server response" : `Request failed (${response.status})`,
    );
  }

  if (!response.ok || !json.ok) {
    const error = json.ok ? { code: "HTTP_ERROR", message: response.statusText } : json.error;
    throw new ApiRequestError(
      error.code,
      error.message,
      "details" in error ? error.details : undefined,
    );
  }

  return json.data;
}

export function apiGet<T>(path: string) {
  return apiFetch<T>(path, { method: "GET", cache: "no-store" });
}

export async function apiDownload(path: string, filename: string) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiRequestError(
      "NETWORK_ERROR",
      "Unable to reach the server. Check your connection and API URL.",
    );
  }

  if (!response.ok) {
    const raw = await response.text();
    try {
      const json = JSON.parse(raw) as ApiError;
      if (!json.ok) {
        throw new ApiRequestError(json.error.code, json.error.message, json.error.details);
      }
    } catch (error) {
      if (error instanceof ApiRequestError) throw error;
      throw new ApiRequestError("HTTP_ERROR", `Download failed (${response.status})`);
    }
    throw new ApiRequestError("HTTP_ERROR", `Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function apiPost<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}
