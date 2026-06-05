import { apiGet } from "@/lib/apiClient";
import * as SecureStore from "expo-secure-store";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

const TOKEN_KEY = "propninja_token";
const USER_KEY = "propninja_user";

let cachedToken: string | null = null;
let cachedUser: SessionUser | null = null;

export async function loadAuth() {
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  const rawUser = await SecureStore.getItemAsync(USER_KEY);
  cachedUser = rawUser ? (JSON.parse(rawUser) as SessionUser) : null;
  if (cachedToken) {
    await refreshCurrentUser();
  }
}

export function getToken() {
  return cachedToken;
}

export function getUser(): SessionUser | null {
  return cachedUser;
}

export function getCurrentUserId() {
  return cachedUser?.id ?? "";
}

export async function setAuth(token: string, user: SessionUser) {
  cachedToken = token;
  cachedUser = user;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearAuth() {
  cachedToken = null;
  cachedUser = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(cachedToken);
}

/** Sync user profile from GET /api/auth/me when a token is present. */
export async function refreshCurrentUser(): Promise<SessionUser | null> {
  if (!cachedToken) return null;
  try {
    const user = await apiGet<SessionUser>("/api/auth/me");
    cachedUser = user;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    return cachedUser;
  }
}
