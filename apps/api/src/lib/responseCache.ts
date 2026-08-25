import { createHash } from "node:crypto";
import type { Context } from "hono";
import NodeCache from "node-cache";
import type { AuthUser } from "../middleware/auth.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";

/** In-memory JSON response cache (single process). */
const cache = new NodeCache({ stdTTL: 0, checkperiod: 120, useClones: false });

export const CACHE_TTL = {
  analytics: 5 * 60,
  reports: 5 * 60,
  reportsLeaderboard: 10 * 60,
  projects: 10 * 60,
  documents: 5 * 60,
  org: 30 * 60,
  leadsShort: 15,
  notificationsShort: 15,
} as const;

const NEVER_CACHE_PREFIXES = ["/api/calls"];

const ORG_SCOPED_ROUTES = new Set(["/api/org"]);

export type CacheHeaderType = "static" | "report" | "none";

export function hashQueryString(queryString: string): string {
  return createHash("sha256").update(queryString).digest("hex").slice(0, 16);
}

export function buildCacheKey(route: string, scopeId: string, queryString: string): string {
  return `${route}#${scopeId}#${hashQueryString(queryString)}`;
}

export function resolveCacheScopeId(route: string, authUser: AuthUser): string {
  if (ORG_SCOPED_ROUTES.has(route) || route.startsWith("/api/org/")) {
    return SINGLE_TENANT_ORG_ID;
  }
  return authUser.id;
}

export function resolveTtlSeconds(pathname: string): number | null {
  if (NEVER_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  if (pathname.startsWith("/api/leads")) {
    // Skip cache for mutation-adjacent endpoints (notes, follow-up, hot, scope-counts)
    if (
      pathname.includes("/notes") ||
      pathname.includes("/follow-up") ||
      pathname.includes("/assign") ||
      pathname.includes("/import") ||
      pathname.includes("/export") ||
      pathname.includes("/duplicate") ||
      pathname === "/api/leads/hot"
    ) {
      return null;
    }
    return CACHE_TTL.leadsShort;
  }

  if (pathname.startsWith("/api/notifications")) {
    // Skip cache for mutation endpoints
    if (pathname.includes("/read") || pathname.includes("/mark")) return null;
    return CACHE_TTL.notificationsShort;
  }

  if (pathname === "/api/analytics/overview") {
    return CACHE_TTL.analytics;
  }

  if (pathname.startsWith("/api/reports/")) {
    if (pathname.includes("/export") || pathname.endsWith("/send-test-email")) {
      return null;
    }
    if (pathname === "/api/reports/leaderboard" || pathname === "/api/reports/agent-stats") {
      return CACHE_TTL.reportsLeaderboard;
    }
    return CACHE_TTL.reports;
  }

  if (pathname.startsWith("/api/projects")) {
    return CACHE_TTL.projects;
  }

  if (pathname === "/api/documents" || pathname.startsWith("/api/documents/")) {
    if (pathname.includes("/share") || pathname.includes("/view")) {
      return null;
    }
    return CACHE_TTL.documents;
  }

  if (pathname === "/api/org" || pathname === "/api/org/") {
    return CACHE_TTL.org;
  }

  return null;
}

export function resolveCacheHeaderType(pathname: string): CacheHeaderType {
  if (pathname === "/api/org" || pathname.startsWith("/api/projects")) {
    return "static";
  }
  if (
    pathname.startsWith("/api/reports/") ||
    pathname.startsWith("/api/analytics/") ||
    pathname.startsWith("/api/documents")
  ) {
    return "report";
  }
  return "none";
}

export function applyCacheControlHeaders(c: Context, type: CacheHeaderType) {
  if (type === "static") {
    c.header("Cache-Control", "private, max-age=300");
    return;
  }
  if (type === "report") {
    c.header("Cache-Control", "private, max-age=300, stale-while-revalidate=60");
  }
}

export function getCachedResponse<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCachedResponse<T>(key: string, value: T, ttlSeconds: number): void {
  cache.set(key, value, ttlSeconds);
}

function deleteKeysMatching(predicate: (key: string) => boolean): number {
  const keys = cache.keys().filter(predicate);
  for (const key of keys) {
    cache.del(key);
  }
  return keys.length;
}

/**
 * Clears cache entries for a route and any nested paths.
 * Keys are `{pathname}#{scopeId}#{queryHash}` — e.g. `/api/reports/agent-stats#…`
 * must match prefix `/api/reports`.
 */
export function clearCacheByRoutePrefix(routePrefix: string): number {
  const exact = `${routePrefix}#`;
  const nested = `${routePrefix}/`;
  return deleteKeysMatching(
    (key) => key === routePrefix || key.startsWith(exact) || key.startsWith(nested),
  );
}

/** Bust report / lead / analytics caches after a call is logged so counts show immediately. */
export function clearCachesAfterCallMutation(userId: string): number {
  return (
    clearCacheByRoutePrefix("/api/reports") +
    clearCacheByRoutePrefix("/api/leads") +
    clearAnalyticsCacheForUser(userId)
  );
}

export function clearAnalyticsCacheForUser(userId: string): number {
  return deleteKeysMatching((key) => {
    const [route, scopeId] = key.split("#");
    return route === "/api/analytics/overview" && scopeId === userId;
  });
}

export function clearOrgCache(): number {
  return clearCacheByRoutePrefix("/api/org");
}

export function clearProjectsCache(): number {
  return clearCacheByRoutePrefix("/api/projects");
}

export function clearAllResponseCaches(): number {
  const count = cache.keys().length;
  cache.flushAll();
  return count;
}

export function buildCacheKeyFromContext(c: Context): string {
  const url = new URL(c.req.url);
  const authUser = c.get("authUser") as AuthUser;
  const scopeId = resolveCacheScopeId(url.pathname, authUser);
  return buildCacheKey(url.pathname, scopeId, url.searchParams.toString());
}

export function shouldBypassResponseCache(c: Context): boolean {
  if (c.req.header("cache-control")?.includes("no-cache")) return true;
  if (c.req.query("refresh") === "true") return true;
  return false;
}

/** Test helper */
export function resetResponseCacheForTests(): void {
  cache.flushAll();
}
