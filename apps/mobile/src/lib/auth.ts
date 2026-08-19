import { ApiRequestError, apiGet, invalidateSession, refreshAccessToken } from "@/lib/apiClient";
import { isTokenExpired } from "@/lib/jwt";
import * as SecureStore from "expo-secure-store";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type AppRole = "admin" | "manager" | "agent";

export function normalizeRole(role: string): AppRole {
  if (role === "admin" || role === "manager") return role;
  return "agent";
}

const TOKEN_KEY = "propninja_token";
const REFRESH_TOKEN_KEY = "propninja_refresh_token";
const USER_KEY = "propninja_user";

let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let cachedUser: SessionUser | null = null;

/** Silently refresh the cached user profile. Never calls invalidateSession or clearAuth. */
async function backgroundSyncUser(): Promise<void> {
  if (!cachedToken) return;
  try {
    const user = await apiGet<SessionUser>("/api/auth/me", { skipSessionLogout: true });
    cachedUser = user;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch {
    // Stale cached profile is fine — ignore all errors
  }
}

export async function loadAuth() {
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  cachedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  const rawUser = await SecureStore.getItemAsync(USER_KEY);
  cachedUser = rawUser ? (JSON.parse(rawUser) as SessionUser) : null;

  if (!cachedToken && !cachedRefreshToken) return;

  if (cachedToken && !isTokenExpired(cachedToken)) {
    // Don't block startup on the network call — update profile in background.
    // Must never trigger logout — use skipSessionLogout and swallow all errors.
    void backgroundSyncUser();
    return;
  }

  if (cachedRefreshToken) {
    try {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        void backgroundSyncUser();
        return;
      }
    } catch {
      // Offline on boot — keep refresh token; user can retry when network returns.
      return;
    }
  }

  await clearAuth();
}

export function getToken() {
  return cachedToken;
}

export function getRefreshToken() {
  return cachedRefreshToken;
}

/**
 * Background tasks (location pings) may run before React loadAuth fills the
 * in-memory cache. Reload tokens from SecureStore when cache is empty.
 */
export async function ensureAuthCacheLoaded(): Promise<void> {
  if (cachedToken || cachedRefreshToken) return;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  cachedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  const rawUser = await SecureStore.getItemAsync(USER_KEY);
  cachedUser = rawUser ? (JSON.parse(rawUser) as SessionUser) : null;
}

export function getUser(): SessionUser | null {
  return cachedUser;
}

export function getCurrentUserId() {
  return cachedUser?.id ?? "";
}

export async function setAuth(token: string, user: SessionUser, refreshToken?: string) {
  cachedToken = token;
  cachedUser = user;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  if (refreshToken) {
    cachedRefreshToken = refreshToken;
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function updateTokens(token: string, refreshToken?: string) {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (refreshToken) {
    cachedRefreshToken = refreshToken;
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function clearAuth() {
  cachedToken = null;
  cachedRefreshToken = null;
  cachedUser = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(cachedToken || cachedRefreshToken);
}

async function ensureAccessTokenFresh(): Promise<"fresh" | "offline" | "invalid"> {
  if (cachedToken && !isTokenExpired(cachedToken)) return "fresh";
  if (!cachedRefreshToken) return "invalid";

  try {
    const refreshed = await refreshAccessToken();
    return refreshed ? "fresh" : "invalid";
  } catch (err) {
    if (err instanceof ApiRequestError && err.code === "NETWORK_ERROR") {
      return "offline";
    }
    return "invalid";
  }
}

/** Sync user profile from GET /api/auth/me when a token is present. */
export async function refreshCurrentUser(retry = false): Promise<SessionUser | null> {
  if (!cachedToken && !cachedRefreshToken) return null;

  const tokenState = await ensureAccessTokenFresh();
  if (tokenState === "offline") return cachedUser;
  if (tokenState === "invalid") {
    invalidateSession();
    return null;
  }

  if (!cachedToken) return cachedUser;

  try {
    const user = await apiGet<SessionUser>("/api/auth/me", { skipSessionLogout: true });
    cachedUser = user;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) {
      if (retry) {
        invalidateSession();
        return null;
      }

      const retryState = await ensureAccessTokenFresh();
      if (retryState === "fresh") {
        return refreshCurrentUser(true);
      }
      if (retryState === "offline") return cachedUser;

      invalidateSession();
      return null;
    }
    return cachedUser;
  }
}
