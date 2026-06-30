import type { Context, Next } from "hono";
import { getAuthCookie } from "../lib/authCookie.js";

const CSRF_HEADER = "x-requested-with";
const CSRF_VALUE = "XMLHttpRequest";

/**
 * Require X-Requested-With for cookie-authenticated mutating requests (CSRF mitigation).
 * Bearer-token clients (mobile) are exempt.
 */
export async function csrfProtectionMiddleware(c: Context, next: Next) {
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    await next();
    return;
  }

  const path = new URL(c.req.url).pathname;
  if (
    path === "/api/auth/login" ||
    path === "/api/auth/refresh" ||
    path === "/api/auth/forgot-password" ||
    path === "/api/auth/reset-password" ||
    path.startsWith("/api/auth/reset-password/") ||
    path.startsWith("/api/integrations/meta/") ||
    path.startsWith("/api/integrations/portal/") ||
    path.startsWith("/api/integrations/whatsapp/") ||
    path === "/api/google-calendar/callback"
  ) {
    await next();
    return;
  }

  const hasCookie = Boolean(getAuthCookie(c));
  const hasBearer = Boolean(c.req.header("Authorization")?.startsWith("Bearer "));
  if (!hasCookie || hasBearer) {
    await next();
    return;
  }

  const header = c.req.header(CSRF_HEADER);
  if (header?.toLowerCase() !== CSRF_VALUE.toLowerCase()) {
    return c.json(
      { ok: false, error: { code: "FORBIDDEN", message: "Missing CSRF protection header" } },
      403,
    );
  }

  await next();
}
