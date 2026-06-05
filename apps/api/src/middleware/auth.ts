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
  // Login is public; all other /api/* routes require a valid JWT.
  const path = new URL(c.req.url).pathname;
  if (path === "/api/auth/login") {
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
    const role = payload.role;
    const email = payload.email;
    const name = payload.name;

    if (
      typeof sub !== "string" ||
      (role !== "admin" && role !== "manager" && role !== "agent") ||
      typeof email !== "string" ||
      typeof name !== "string"
    ) {
      return c.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid token claims" } },
        401,
      );
    }

    c.set("authUser", { id: sub, role, email, name });
    c.set("db", getDb());
    await next();
  } catch {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
      401,
    );
  }
};
