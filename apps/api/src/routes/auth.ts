import { users } from "@propninja/db";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../lib/db.js";
import { issueAuthToken } from "../lib/issueAuthToken.js";
import { decodeJwtPayload } from "../lib/jwtPayload.js";
import { honoLoginIpRateLimit } from "../lib/loginBruteForce.js";
import { verifyPassword } from "../lib/password.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { changePasswordSchema } from "../lib/validators/users.js";
import type { AuthUser } from "../middleware/auth.js";
import { loginRateLimit } from "../middleware/rateLimit.js";
import { listLoginHistory, recordSuccessfulLogin } from "../services/loginEventService.js";
import { setUserPassword } from "../services/passwordHistoryService.js";
import {
  completePasswordReset,
  requestPasswordReset,
  validatePasswordResetToken,
} from "../services/passwordResetService.js";
import { addTokenToBlocklist, revokeAllUserSessions } from "../services/tokenRevocationService.js";

export const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  newPassword: z.string().min(8),
});

authRoutes.post("/login", loginRateLimit, honoLoginIpRateLimit(), async (c) => {
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
  const normalizedEmail = email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);

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
  const { token } = await issueAuthToken({
    id: row.id,
    email: row.email,
    name: row.name,
    role,
  });

  await recordSuccessfulLogin(c, db, row.id);

  return c.json({
    ok: true,
    data: {
      token,
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role,
        isFirstLogin: row.isFirstLogin,
      },
    },
  });
});

authRoutes.get("/me", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);

  return c.json({
    ok: true,
    data: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      role: authUser.role,
      isFirstLogin: row?.isFirstLogin ?? false,
    },
  });
});

authRoutes.post("/change-password", validate("json", changePasswordSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");
  const db = getDb();

  const [row] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);
  if (!row?.passwordHash) {
    return jsonError(c, "UNAUTHORIZED", "Account not found", 401);
  }

  const currentValid = await verifyPassword(body.currentPassword, row.passwordHash);
  if (!currentValid) {
    return jsonError(c, "UNAUTHORIZED", "Current password is incorrect", 401);
  }

  const result = await setUserPassword(db, authUser.id, body.newPassword, row.passwordHash);
  if (!result.valid) {
    return jsonError(
      c,
      "VALIDATION_ERROR",
      result.errors[0] ?? "Password does not meet requirements",
      400,
      result.errors,
    );
  }

  const authHeader = c.req.header("Authorization");
  const currentToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (currentToken) {
    const { jti } = decodeJwtPayload(currentToken);
    if (jti) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await addTokenToBlocklist({
        jti,
        userId: authUser.id,
        expiresAt,
        reason: "password_changed",
      });
    }
  }

  await revokeAllUserSessions(authUser.id);

  const { token } = await issueAuthToken({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as AuthUser["role"],
  });

  return jsonOk(c, {
    token,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isFirstLogin: false,
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

authRoutes.post("/logout", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const authHeader = c.req.header("Authorization");
  const currentToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (currentToken) {
    const { jti } = decodeJwtPayload(currentToken);
    if (jti) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await addTokenToBlocklist({
        jti,
        userId: authUser.id,
        expiresAt,
        reason: "logout",
      });
    }
  }

  return jsonOk(c, { message: "Logged out" });
});

authRoutes.post("/forgot-password", validate("json", forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid("json");
  await requestPasswordReset(email);
  return jsonOk(c, {
    message: "If that email is registered, a password reset link has been sent.",
  });
});

authRoutes.get("/reset-password/:token", async (c) => {
  const token = c.req.param("token");
  const validation = await validatePasswordResetToken(token);

  if (!validation.valid) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid or expired reset token", 400);
  }

  return jsonOk(c, { valid: true, email: validation.email });
});

authRoutes.post("/reset-password", validate("json", resetPasswordSchema), async (c) => {
  const { token, newPassword } = c.req.valid("json");
  const result = await completePasswordReset(token, newPassword);

  if (!result.valid) {
    if ("reason" in result) {
      return jsonError(c, "VALIDATION_ERROR", "Invalid or expired reset token", 400);
    }
    return jsonError(
      c,
      "VALIDATION_ERROR",
      result.errors[0] ?? "Password does not meet requirements",
      400,
      result.errors,
    );
  }

  return jsonOk(c, { message: "Password updated" });
});

authRoutes.get("/login-history", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = getDb();
  const events = await listLoginHistory(db, { userId: authUser.id, limit: 20 });

  return jsonOk(
    c,
    events.map((event) => ({
      ip: event.ipAddress,
      userAgent: event.userAgent,
      createdAt: event.createdAt.toISOString(),
      success: true,
    })),
  );
});
