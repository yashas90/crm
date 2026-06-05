import { apiGet } from "@/lib/apiClient";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

const TOKEN_KEY = "propninja_token";
const USER_KEY = "propninja_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

/** Refresh the cached user from GET /api/auth/me (requires a stored token). */
export async function fetchCurrentUser(): Promise<SessionUser | null> {
  if (!getToken()) return null;
  try {
    const user = await apiGet<SessionUser>("/api/auth/me");
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    return getSession();
  }
}
