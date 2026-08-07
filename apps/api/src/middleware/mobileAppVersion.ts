import type { Context, Next } from "hono";
import { env } from "../lib/env.js";
import {
  isMobileAppVersionAtLeast,
  looksLikeNativeMobileClient,
  parseSemver,
} from "../lib/mobileAppVersion.js";
import { jsonError } from "../lib/response.js";

const CLIENT_HEADER = "x-propninja-client";
const VERSION_HEADER = "x-propninja-app-version";

function isExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/integrations/meta/") ||
    pathname.startsWith("/api/integrations/portal/") ||
    pathname.startsWith("/api/integrations/whatsapp/") ||
    pathname === "/api/google-calendar/callback" ||
    pathname === "/api/meta/oauth/callback" ||
    /^\/api\/documents\/[^/]+\/view$/.test(pathname)
  );
}

/**
 * When MIN_MOBILE_APP_VERSION is set, block outdated PropNinja mobile clients.
 * Web browsers and integration webhooks are not affected.
 */
export async function mobileAppVersionMiddleware(c: Context, next: Next) {
  const minimum = env.MIN_MOBILE_APP_VERSION?.trim() || "";
  if (!minimum || !parseSemver(minimum)) {
    await next();
    return;
  }

  const pathname = new URL(c.req.url).pathname;
  if (isExemptPath(pathname)) {
    await next();
    return;
  }

  const client = (c.req.header(CLIENT_HEADER) ?? "").trim().toLowerCase();
  const appVersion = (c.req.header(VERSION_HEADER) ?? "").trim();
  const userAgent = c.req.header("user-agent");
  const isMobileClient = client === "mobile" || looksLikeNativeMobileClient(userAgent);

  if (!isMobileClient) {
    await next();
    return;
  }

  const updateUrl = env.MOBILE_UPDATE_URL?.trim() || null;
  const details = {
    minMobileAppVersion: minimum,
    updateUrl,
  };

  if (!appVersion || !parseSemver(appVersion)) {
    return jsonError(
      c,
      "APP_UPDATE_REQUIRED",
      `This app version is no longer supported. Please update to ${minimum} or newer.`,
      426,
      details,
    );
  }

  if (!isMobileAppVersionAtLeast(appVersion, minimum)) {
    return jsonError(
      c,
      "APP_UPDATE_REQUIRED",
      `Please update PropNinja to version ${minimum} or newer to continue.`,
      426,
      details,
    );
  }

  await next();
}
