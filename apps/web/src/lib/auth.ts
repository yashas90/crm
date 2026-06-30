import { apiGet, apiPost } from "@/lib/apiClient";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isFirstLogin?: boolean;
};

/** Lightweight marker cookie for Next.js middleware (JWT is HttpOnly on the API domain). */
export const SESSION_COOKIE_NAME = "propninja_session";
export const SESSION_COOKIE_VALUE = "1";

const USER_KEY = "propninja_user";
/** Align with refresh-token lifetime so middleware stays valid while refresh works. */
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
  if (getSession()) setSessionCookie();
}

/** JWT is stored in an HttpOnly cookie — not readable from JavaScript. */
export function getToken(): string | null {
  return null;
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

export function setAuth(_token: string, user: SessionUser) {
  localStorage.removeItem("propninja_token");
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  setSessionCookie();
}

export function clearSession() {
  localStorage.removeItem("propninja_token");
  localStorage.removeItem(USER_KEY);
  clearSessionCookie();
}

/** Revoke HttpOnly API session and clear local web session state. */
export async function logoutSession() {
  try {
    await apiPost("/api/auth/logout", {});
  } catch {
    // Best-effort — clear local state even if API is unreachable
  }
  clearSession();
}

export function isAuthenticated() {
  return Boolean(getSession());
}

/** Refresh the cached user from GET /api/auth/me (uses HttpOnly session cookie). */
export async function fetchCurrentUser(): Promise<SessionUser | null> {
  if (!getSession()) return null;
  try {
    const user = await apiGet<SessionUser>("/api/auth/me");
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    return getSession();
  }
}
