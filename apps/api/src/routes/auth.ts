import { users } from "@propninja/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { SignJWT } from "jose";
import { z } from "zod";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { getDb } from "../lib/db.js";
import { getJwtSecret } from "../lib/jwt.js";
import { verifyPassword } from "../lib/password.js";
import { jsonOk } from "../lib/response.js";
import type { AuthUser } from "../middleware/auth.js";
import { loginRateLimit } from "../middleware/rateLimit.js";

export const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRoutes.post("/login", loginRateLimit, async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid credentials payload" },
      },
      400,
    );
  }

  const { email, password } = parsed.data;
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

  if (!row?.isActive || !row.passwordHash) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid email or password" } },
      401,
    );
  }

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid email or password" } },
      401,
    );
  }

  const role = row.role as AuthUser["role"];
  const token = await new SignJWT({
    sub: row.id,
    email: row.email,
    name: row.name,
    role,
    orgId: SINGLE_TENANT_ORG_ID,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());

  return c.json({
    ok: true,
    data: {
      token,
      user: { id: row.id, email: row.email, name: row.name, role },
    },
  });
});

authRoutes.get("/me", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return c.json({
    ok: true,
    data: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      role: authUser.role,
    },
  });
});

const pushTokenSchema = z.object({ token: z.string().min(1).max(512) });

authRoutes.post("/push-token", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = await c.req.json().catch(() => ({}));
  const parsed = pushTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid token" } },
      400,
    );
  }
  const db = getDb();
  await db.update(users).set({ expoPushToken: parsed.data.token }).where(eq(users.id, authUser.id));
  return jsonOk(c, { registered: true });
});
