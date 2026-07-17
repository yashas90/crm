import { users } from "@propninja/db";
import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { jwtVerify } from "jose";
import { getAuthCookie } from "../lib/authCookie.js";
import { getDb } from "../lib/db.js";
import { getJwtSecret } from "../lib/jwt.js";
import { isJtiBlocked, isUserSessionRevoked } from "../lib/tokenBlocklist.js";

export type AuthUser = {
  id: string;
  role: "admin" | "manager" | "agent";
  email: string;
  name: string;
  orgId: string;
  isFirstLogin: boolean;
};

declare module "hono" {
  interface ContextVariableMap {
    authUser: AuthUser;
    db: ReturnType<typeof getDb>;
  }
}

function bearerToken(c: Context) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

export const authMiddleware = async (c: Context, next: Next) => {
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
    /^\/api\/documents\/[^/]+\/view$/.test(path) ||
    path === "/api/google-calendar/callback" ||
    path === "/api/meta/oauth/callback"
  ) {
    c.set("db", getDb());
    await next();
    return;
  }

  const token = bearerToken(c) ?? getAuthCookie(c) ?? null;
  if (!token) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Missing or invalid token" } },
      401,
    );
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const sub = payload.sub;
    const jti = typeof payload.jti === "string" ? payload.jti : null;
    const iat = typeof payload.iat === "number" ? payload.iat : null;

    if (typeof sub !== "string") {
      return c.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid token claims" } },
        401,
      );
    }

    if (jti && isJtiBlocked(jti)) {
      return c.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Token has been revoked" } },
        401,
      );
    }

    if (iat !== null && isUserSessionRevoked(sub, iat)) {
      return c.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Session has been revoked" } },
        401,
      );
    }

    const db = getDb();
    const [row] = await db.select().from(users).where(eq(users.id, sub)).limit(1);

    if (!row?.isActive) {
      return c.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
        401,
      );
    }

    const role = row.role;
    if (role !== "admin" && role !== "manager" && role !== "agent") {
      return c.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid token claims" } },
        401,
      );
    }

    c.set("authUser", {
      id: row.id,
      role,
      email: row.email,
      name: row.name,
      orgId: row.orgId,
      isFirstLogin: row.isFirstLogin,
    });
    c.set("db", db);
    await next();
  } catch {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
      401,
    );
  }
};
