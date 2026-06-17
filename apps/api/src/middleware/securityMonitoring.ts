import type { Context, Next } from "hono";
import { getClientIp } from "../lib/clientIp.js";
import { blockIp, isIpBlocked } from "../lib/ipBlocklist.js";
import type { AuthUser } from "../middleware/auth.js";
import { SECURITY_ALERT_TYPES, createSecurityAlert } from "../services/securityAlertService.js";

const TEN_MIN_MS = 10 * 60 * 1000;
const LEAD_FETCH_THRESHOLD = 500;
const IP_LEADS_HIT_THRESHOLD = 200;

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

/** Reject requests from auto-blocked IPs (before auth). */
export const ipBlocklistMiddleware = async (c: Context, next: Next) => {
  const path = new URL(c.req.url).pathname;
  if (!path.startsWith("/api/")) {
    await next();
    return;
  }

  const ip = getClientIp(c);
  if (isIpBlocked(ip)) {
    return c.json(
      { ok: false, error: { code: "IP_BLOCKED", message: "Too many requests. Try again later." } },
      429,
    );
  }

  await next();
};

/** Track bulk lead access and IP flooding on /api/leads. */
export const securityMonitoringMiddleware = async (c: Context, next: Next) => {
  const path = new URL(c.req.url).pathname;
  const method = c.req.method;

  if (method === "GET" && path.startsWith("/api/leads")) {
    const ip = getClientIp(c);
    const ipWindow = getIpWindow(ip);
    ipWindow.hits += 1;

    if (ipWindow.hits > IP_LEADS_HIT_THRESHOLD) {
      blockIp(ip);
      const db = c.get("db");
      if (db) {
        void createSecurityAlert(db, {
          alertType: SECURITY_ALERT_TYPES.IP_LEADS_FLOOD,
          details: { hits: ipWindow.hits, path, windowMinutes: 10 },
          ipAddress: ip,
        });
      }
      return c.json(
        {
          ok: false,
          error: { code: "IP_BLOCKED", message: "Too many requests. Try again later." },
        },
        429,
      );
    }
  }

  await next();

  if (method !== "GET" || !path.startsWith("/api/leads")) return;

  const authUser = c.get("authUser") as AuthUser | undefined;
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

export { LEAD_FETCH_THRESHOLD, IP_LEADS_HIT_THRESHOLD, TEN_MIN_MS as SECURITY_WINDOW_MS };
