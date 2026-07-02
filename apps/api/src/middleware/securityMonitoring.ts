import type { Context, Next } from "hono";
import { getClientIp } from "../lib/clientIp.js";
import { isIpBlocked, unblockIp } from "../lib/ipBlocklist.js";
import type { AuthUser } from "../middleware/auth.js";
import { SECURITY_ALERT_TYPES, createSecurityAlert } from "../services/securityAlertService.js";

const TEN_MIN_MS = 10 * 60 * 1000;
const LEAD_FETCH_THRESHOLD = 500;
/** Alert-only threshold for unauthenticated scrapers — never auto-block (shared office NAT). */
const IP_LEADS_HIT_ALERT_THRESHOLD = 5000;

type UserWindow = { leadRows: number; startedAt: number };
type IpWindow = { hits: number; startedAt: number };

const userLeadFetchWindows = new Map<string, UserWindow>();
const ipLeadsHitWindows = new Map<string, IpWindow>();

function getUserWindow(userId: string): UserWindow {
  const now = Date.now();
  const existing = userLeadFetchWindows.get(userId);
  if (!existing || now - existing.startedAt >= TEN_MIN_MS) {
    const fresh = { leadRows: 0, startedAt: now };
    userLeadFetchWindows.set(userId, fresh);
    return fresh;
  }
  return existing;
}

function getIpWindow(ip: string): IpWindow {
  const now = Date.now();
  const existing = ipLeadsHitWindows.get(ip);
  if (!existing || now - existing.startedAt >= TEN_MIN_MS) {
    const fresh = { hits: 0, startedAt: now };
    ipLeadsHitWindows.set(ip, fresh);
    return fresh;
  }
  return existing;
}

function hasBearerToken(c: Context): boolean {
  return c.req.header("Authorization")?.startsWith("Bearer ") ?? false;
}

/** Reject requests from auto-blocked IPs (before auth). Logged-in CRM traffic is never blocked here. */
export const ipBlocklistMiddleware = async (c: Context, next: Next) => {
  const path = new URL(c.req.url).pathname;
  if (!path.startsWith("/api/")) {
    await next();
    return;
  }

  if (hasBearerToken(c)) {
    await next();
    return;
  }

  const ip = getClientIp(c);
  if (ip && (await isIpBlocked(ip))) {
    return c.json(
      { ok: false, error: { code: "IP_BLOCKED", message: "Too many requests. Try again later." } },
      429,
    );
  }

  await next();
};

/** Clear stale IP blocks when a valid session reaches the API (self-heal after false positives). */
export const healIpBlockForAuthenticatedUser = async (c: Context, next: Next) => {
  const authUser = c.get("authUser") as AuthUser | undefined;
  if (authUser) {
    const ip = getClientIp(c);
    if (ip && (await isIpBlocked(ip))) {
      await unblockIp(ip);
    }
  }

  await next();
};

/** Track bulk lead access and IP flooding on /api/leads. */
export const securityMonitoringMiddleware = async (c: Context, next: Next) => {
  const path = new URL(c.req.url).pathname;
  const method = c.req.method;
  const authUser = c.get("authUser") as AuthUser | undefined;

  if (method === "GET" && (path.startsWith("/api/leads") || path === "/api/leads/export")) {
    const ip = getClientIp(c) ?? "unknown";

    // Logged-in CRM users poll leads often; office/carrier NAT shares one IP across agents.
    // Monitor unauthenticated traffic only — alert admins, never auto-block the IP.
    if (!authUser) {
      const ipWindow = getIpWindow(ip);
      ipWindow.hits += 1;

      if (ipWindow.hits === IP_LEADS_HIT_ALERT_THRESHOLD + 1) {
        const db = c.get("db");
        if (db) {
          void createSecurityAlert(db, {
            alertType: SECURITY_ALERT_TYPES.IP_LEADS_FLOOD,
            details: {
              hits: ipWindow.hits,
              path,
              windowMinutes: 10,
              note: "alert-only; IP not auto-blocked",
            },
            ipAddress: ip,
          });
        }
      }
    }
  }

  await next();

  if (method !== "GET" || (!path.startsWith("/api/leads") && path !== "/api/leads/export")) return;

  if (!authUser) return;

  let rowCount = 0;
  try {
    const cloned = c.res.clone();
    const body = (await cloned.json()) as {
      ok?: boolean;
      data?: {
        items?: unknown[];
        total?: number;
        pageSize?: number;
        leads?: unknown[];
      };
    };
    if (body?.ok && body.data) {
      if (Array.isArray(body.data.items)) {
        rowCount = body.data.items.length;
      } else if (Array.isArray(body.data.leads)) {
        rowCount = body.data.leads.length;
      } else if (typeof body.data.total === "number") {
        rowCount = Math.min(body.data.total, body.data.pageSize ?? body.data.total);
      }
    }
  } catch {
    return;
  }

  if (rowCount <= 0) return;

  const window = getUserWindow(authUser.id);
  window.leadRows += rowCount;

  if (window.leadRows > LEAD_FETCH_THRESHOLD) {
    const db = c.get("db");
    if (db) {
      void createSecurityAlert(db, {
        userId: authUser.id,
        alertType: SECURITY_ALERT_TYPES.BULK_LEAD_FETCH,
        details: {
          leadRows: window.leadRows,
          threshold: LEAD_FETCH_THRESHOLD,
          windowMinutes: 10,
          lastPath: path,
        },
        ipAddress: getClientIp(c),
      });
    }
  }
};

/** Reset in-memory windows — for tests. */
export function resetSecurityMonitoringState(): void {
  userLeadFetchWindows.clear();
  ipLeadsHitWindows.clear();
}

export { LEAD_FETCH_THRESHOLD, IP_LEADS_HIT_ALERT_THRESHOLD, TEN_MIN_MS as SECURITY_WINDOW_MS };
