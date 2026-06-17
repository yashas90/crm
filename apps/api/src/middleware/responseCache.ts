import type { Context, Next } from "hono";
import {
  buildCacheKeyFromContext,
  getCachedResponse,
  resolveCacheHeaderType,
  resolveTtlSeconds,
  setCachedResponse,
  shouldBypassResponseCache,
} from "../lib/responseCache.js";

/**
 * Caches successful JSON GET responses for configured API routes.
 * Key pattern: `{pathname}:{userId|orgId}:{queryHash}`
 */
export async function responseCacheMiddleware(c: Context, next: Next) {
  if (c.req.method !== "GET") {
    await next();
    return;
  }

  const url = new URL(c.req.url);
  const ttlSeconds = resolveTtlSeconds(url.pathname);
  if (ttlSeconds === null) {
    await next();
    return;
  }

  const headerType = resolveCacheHeaderType(url.pathname);
  const bypass = shouldBypassResponseCache(c);
  const cacheKey = buildCacheKeyFromContext(c);

  if (!bypass) {
    const cached = getCachedResponse<unknown>(cacheKey);
    if (cached !== undefined) {
      const headers: Record<string, string> = {};
      if (headerType === "static") {
        headers["Cache-Control"] = "private, max-age=300";
      } else if (headerType === "report") {
        headers["Cache-Control"] = "private, max-age=300, stale-while-revalidate=60";
      }
      return c.json(cached, 200, { headers });
    }
  }

  await next();

  if (bypass || c.res.status !== 200) {
    return;
  }

  const contentType = c.res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return;
  }

  try {
    const body = await c.res.clone().json();
    setCachedResponse(cacheKey, body, ttlSeconds);

    const headers: Record<string, string> = {};
    if (headerType === "static") {
      headers["Cache-Control"] = "private, max-age=300";
    } else if (headerType === "report") {
      headers["Cache-Control"] = "private, max-age=300, stale-while-revalidate=60";
    }
    return c.json(body, 200, { headers });
  } catch {
    // Ignore non-JSON or unreadable bodies.
  }
}
