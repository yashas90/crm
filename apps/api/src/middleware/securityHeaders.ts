import type { Context, Next } from "hono";
import { env } from "../lib/env.js";

/** Standard security headers for all API responses. */
export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next();

  if (env.NODE_ENV === "production") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.res.headers.delete("X-Powered-By");
}
