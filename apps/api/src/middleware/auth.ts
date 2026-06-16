import { users } from "@propninja/db";
import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { jwtVerify } from "jose";
import { getDb } from "../lib/db.js";
import { getJwtSecret } from "../lib/jwt.js";

export type AuthUser = {
  id: string;
  role: "admin" | "manager" | "agent";
  email: string;
  name: string;
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
  // Public routes: login and Meta Lead Ads webhook (verified via META_VERIFY_TOKEN).
  const path = new URL(c.req.url).pathname;
  if (path === "/api/auth/login" || path.startsWith("/api/integrations/meta/")) {
    c.set("db", getDb());
    await next();
    return;
  }

  const token = bearerToken(c);
  if (!token) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Missing or invalid token" } },
      401,
    );
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const sub = payload.sub;

    if (typeof sub !== "string") {
      return c.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid token claims" } },
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

    c.set("authUser", { id: row.id, role, email: row.email, name: row.name });
    c.set("db", db);
    await next();
  } catch {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
      401,
    );
  }
};
