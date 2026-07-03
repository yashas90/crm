import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Must match SESSION_COOKIE_NAME / SESSION_COOKIE_VALUE in lib/auth.ts */
const SESSION_COOKIE_NAME = "propninja_session";
const SESSION_COOKIE_VALUE = "1";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/sitevisit"];

/** URL prefixes for the (dashboard) route group (group name is not in the path). */
const DASHBOARD_PREFIXES = [
  "/leads",
  "/pipeline",
  "/reports",
  "/projects",
  "/users",
  "/settings",
  "/documents",
  "/analytics",
  "/performance",
  "/site-visits",
  "/bookings",
  "/tasks",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isDashboardPath(pathname: string) {
  if (pathname === "/") return true;
  return DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isDashboardPath(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(SESSION_COOKIE_NAME)?.value === SESSION_COOKIE_VALUE;
  if (!hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on page routes only; skip static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
