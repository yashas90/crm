import { ApiRequestError, apiGet, runWithSessionLogoutSuppressed } from "@/lib/apiClient";
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

export async function loadAuth() {
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  cachedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  const rawUser = await SecureStore.getItemAsync(USER_KEY);
  cachedUser = rawUser ? (JSON.parse(rawUser) as SessionUser) : null;

  if (!cachedToken && !cachedRefreshToken) return;

  if (cachedToken && !isTokenExpired(cachedToken)) {
    await runWithSessionLogoutSuppressed(() => refreshCurrentUser());
    return;
  }

  if (cachedRefreshToken) {
    const { refreshAccessToken } = await import("@/lib/apiClient");
    try {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        await runWithSessionLogoutSuppressed(() => refreshCurrentUser());
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

/** Sync user profile from GET /api/auth/me when a token is present. */
export async function refreshCurrentUser(): Promise<SessionUser | null> {
  if (!cachedToken) return null;
  if (isTokenExpired(cachedToken)) {
    await clearAuth();
    return null;
  }

  try {
    const user = await apiGet<SessionUser>("/api/auth/me", { skipSessionLogout: true });
    cachedUser = user;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) {
      await clearAuth();
      return null;
    }
    return cachedUser;
  }
}
