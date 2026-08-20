import { beforeEach, describe, expect, it } from "vitest";
import {
  CACHE_TTL,
  buildCacheKey,
  clearAllResponseCaches,
  clearAnalyticsCacheForUser,
  clearCacheByRoutePrefix,
  clearCachesAfterCallMutation,
  clearOrgCache,
  clearProjectsCache,
  getCachedResponse,
  resetResponseCacheForTests,
  resolveTtlSeconds,
  setCachedResponse,
} from "./responseCache.js";

describe("responseCache", () => {
  beforeEach(() => {
    resetResponseCacheForTests();
  });

  it("builds stable keys with route, scope, and query hash", () => {
    const key = buildCacheKey("/api/org", "org-id", "foo=1");
    expect(key.startsWith("/api/org#org-id#")).toBe(true);
    expect(buildCacheKey("/api/org", "org-id", "foo=1")).toBe(key);
  });

  it("stores and retrieves cached payloads with TTL", () => {
    const key = buildCacheKey("/api/reports/overview", "user-1", "");
    setCachedResponse(key, { ok: true, data: { total: 1 } }, CACHE_TTL.reports);
    expect(getCachedResponse(key)).toEqual({ ok: true, data: { total: 1 } });
  });

  it("resolves TTLs for cacheable routes", () => {
    expect(resolveTtlSeconds("/api/analytics/overview")).toBe(300);
    expect(resolveTtlSeconds("/api/reports/agent-stats")).toBe(600);
    expect(resolveTtlSeconds("/api/projects")).toBe(600);
    expect(resolveTtlSeconds("/api/org")).toBe(1800);
    expect(resolveTtlSeconds("/api/leads")).toBe(CACHE_TTL.leadsShort);
    expect(resolveTtlSeconds("/api/leads/hot")).toBeNull();
    expect(resolveTtlSeconds("/api/leads/abc/notes")).toBeNull();
    expect(resolveTtlSeconds("/api/calls")).toBeNull();
    expect(resolveTtlSeconds("/api/notifications")).toBe(CACHE_TTL.notificationsShort);
    expect(resolveTtlSeconds("/api/notifications/read-all")).toBeNull();
    expect(resolveTtlSeconds("/api/reports/calls/export")).toBeNull();
  });

  it("clears analytics cache scoped to a user", () => {
    const userA = "00000000-0000-0000-0000-000000000002";
    const userB = "00000000-0000-0000-0000-000000000003";
    setCachedResponse(buildCacheKey("/api/analytics/overview", userA, ""), { a: 1 }, 300);
    setCachedResponse(buildCacheKey("/api/analytics/overview", userB, ""), { b: 1 }, 300);

    expect(clearAnalyticsCacheForUser(userA)).toBe(1);
    expect(getCachedResponse(buildCacheKey("/api/analytics/overview", userA, ""))).toBeUndefined();
    expect(getCachedResponse(buildCacheKey("/api/analytics/overview", userB, ""))).toEqual({
      b: 1,
    });
  });

  it("clears nested report and lead routes by prefix", () => {
    const statsKey = buildCacheKey("/api/reports/agent-stats", "user-1", "");
    const overviewKey = buildCacheKey("/api/reports/overview", "user-1", "");
    const leadsKey = buildCacheKey("/api/leads", "user-1", "page=1");
    const leadDetailKey = buildCacheKey("/api/leads/lead-1", "user-1", "");
    setCachedResponse(statsKey, { calls: 1 }, 600);
    setCachedResponse(overviewKey, { ok: true }, 300);
    setCachedResponse(leadsKey, { items: [] }, 15);
    setCachedResponse(leadDetailKey, { id: "lead-1" }, 15);

    expect(clearCacheByRoutePrefix("/api/reports")).toBe(2);
    expect(getCachedResponse(statsKey)).toBeUndefined();
    expect(getCachedResponse(overviewKey)).toBeUndefined();
    expect(getCachedResponse(leadsKey)).toBeDefined();

    expect(clearCacheByRoutePrefix("/api/leads")).toBe(2);
    expect(getCachedResponse(leadsKey)).toBeUndefined();
    expect(getCachedResponse(leadDetailKey)).toBeUndefined();
  });

  it("clearCachesAfterCallMutation busts reports, leads, and analytics", () => {
    const userId = "00000000-0000-0000-0000-000000000003";
    const otherUser = "00000000-0000-0000-0000-000000000002";
    setCachedResponse(buildCacheKey("/api/reports/agent-stats", userId, ""), { c: 1 }, 600);
    setCachedResponse(buildCacheKey("/api/leads", userId, ""), { items: [] }, 15);
    setCachedResponse(buildCacheKey("/api/analytics/overview", userId, ""), { a: 1 }, 300);
    setCachedResponse(buildCacheKey("/api/analytics/overview", otherUser, ""), { b: 1 }, 300);
    setCachedResponse(buildCacheKey("/api/projects", userId, ""), { p: 1 }, 600);

    expect(clearCachesAfterCallMutation(userId)).toBe(3);
    expect(
      getCachedResponse(buildCacheKey("/api/reports/agent-stats", userId, "")),
    ).toBeUndefined();
    expect(getCachedResponse(buildCacheKey("/api/leads", userId, ""))).toBeUndefined();
    expect(getCachedResponse(buildCacheKey("/api/analytics/overview", userId, ""))).toBeUndefined();
    expect(getCachedResponse(buildCacheKey("/api/analytics/overview", otherUser, ""))).toEqual({
      b: 1,
    });
    expect(getCachedResponse(buildCacheKey("/api/projects", userId, ""))).toEqual({ p: 1 });
  });

  it("clears org and projects caches by route prefix", () => {
    setCachedResponse(buildCacheKey("/api/org", "org", ""), { org: true }, 300);
    setCachedResponse(buildCacheKey("/api/projects", "user", "page=1"), { projects: [] }, 600);

    clearOrgCache();
    expect(getCachedResponse(buildCacheKey("/api/org", "org", ""))).toBeUndefined();
    expect(getCachedResponse(buildCacheKey("/api/projects", "user", "page=1"))).toBeDefined();

    clearProjectsCache();
    expect(getCachedResponse(buildCacheKey("/api/projects", "user", "page=1"))).toBeUndefined();
  });

  it("flushAll clears every entry", () => {
    setCachedResponse(buildCacheKey("/api/documents", "user", ""), { items: [] }, 300);
    expect(clearAllResponseCaches()).toBe(1);
    expect(getCachedResponse(buildCacheKey("/api/documents", "user", ""))).toBeUndefined();
  });
});
