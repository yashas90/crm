import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { parseDurationToSeconds } from "./duration.js";
import { env } from "./env.js";

export const AUTH_COOKIE_NAME = "propninja_auth";
export const REFRESH_COOKIE_NAME = "propninja_refresh";

/** Matches JWT access-token lifetime. */
export const AUTH_COOKIE_MAX_AGE_SECONDS = parseDurationToSeconds(env.JWT_EXPIRES_IN);

/** Matches refresh-token lifetime. */
export const REFRESH_COOKIE_MAX_AGE_SECONDS = parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN);

function cookieOptions(maxAge: number) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ("None" as const) : ("Lax" as const),
    path: "/",
    maxAge,
  };
}

export function setAuthCookie(c: Context, token: string) {
  setCookie(c, AUTH_COOKIE_NAME, token, cookieOptions(AUTH_COOKIE_MAX_AGE_SECONDS));
}

export function setRefreshCookie(c: Context, token: string) {
  setCookie(c, REFRESH_COOKIE_NAME, token, cookieOptions(REFRESH_COOKIE_MAX_AGE_SECONDS));
}

export function clearAuthCookie(c: Context) {
  const secure = process.env.NODE_ENV === "production";
  const sameSite = secure ? ("None" as const) : ("Lax" as const);
  deleteCookie(c, AUTH_COOKIE_NAME, { path: "/", secure, sameSite });
}

export function clearRefreshCookie(c: Context) {
  const secure = process.env.NODE_ENV === "production";
  const sameSite = secure ? ("None" as const) : ("Lax" as const);
  deleteCookie(c, REFRESH_COOKIE_NAME, { path: "/", secure, sameSite });
}

export function getAuthCookie(c: Context): string | undefined {
  return getCookie(c, AUTH_COOKIE_NAME);
}

export function getRefreshCookie(c: Context): string | undefined {
  return getCookie(c, REFRESH_COOKIE_NAME);
}
