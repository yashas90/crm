import { apiGet } from "@/lib/apiClient";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

/** Lightweight marker cookie for Next.js middleware (JWT remains in localStorage). */
export const SESSION_COOKIE_NAME = "propninja_session";
export const SESSION_COOKIE_VALUE = "1";

const TOKEN_KEY = "propninja_token";
const USER_KEY = "propninja_user";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function sessionCookieAttributes(maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
  return `path=/; max-age=${maxAge}; samesite=lax${secure}`;
}

export function setSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_NAME}=${SESSION_COOKIE_VALUE}; ${sessionCookieAttributes()}`;
}

export function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

/** Backfill cookie for sessions created before middleware shipped. */
export function ensureSessionCookie() {
  if (getToken()) setSessionCookie();
}

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
  setSessionCookie();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearSessionCookie();
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
