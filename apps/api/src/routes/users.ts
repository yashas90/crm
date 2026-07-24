import { Hono } from "hono";
import type { Context } from "hono";
import { AUDIT_ACTIONS } from "../lib/auditActions.js";
import {
  canListUsers,
  canListUsersForQuery,
  canViewUsers,
  hasPermission,
  isAdmin,
} from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { resolveUserRoleFields } from "../lib/role-mapping.js";
import { validate } from "../lib/validate.js";
import { uuidParamSchema } from "../lib/validators/common.js";
import {
  createUserSchema,
  listUsersQuerySchema,
  resetUserPasswordSchema,
  updateUserSchema,
  userExportQuerySchema,
  userScopeCountsQuerySchema,
} from "../lib/validators/users.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { logAudit } from "../services/auditService.js";
import { createUserService } from "../services/userService.js";

export const usersRoutes = new Hono();

function requireAdmin(c: Context) {
  const authUser = c.get("authUser");
  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Only admins can perform this action", 403);
  }
  return null;
}

function requireUpdateUser(c: Context) {
  const authUser = c.get("authUser");
  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "You cannot update users", 403);
  }
  return null;
}

function requireListUsers(c: Context) {
  const authUser = c.get("authUser");
  if (!canListUsers(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

function requireViewUsers(c: Context) {
  const authUser = c.get("authUser");
  if (!canViewUsers(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

function requireExportUsers(c: Context) {
  const authUser = c.get("authUser");
  if (!hasPermission(authUser, "users:export")) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

usersRoutes.get("/scope-counts", async (c) => {
  const denied = requireListUsers(c);
  if (denied) return denied;

  const parsed = userScopeCountsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid query", 400, parsed.error.flatten());
  }

  const service = createUserService(c.get("db"));
  const data = await service.getScopeCounts(parsed.data);

  return c.json({ ok: true, data });
});

usersRoutes.get("/", validate("query", listUsersQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const authUser = c.get("authUser");

  if (!canListUsersForQuery(authUser, query)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  // Agents only get the active-admin picker — never a broader directory.
  const listQuery =
    authUser.role === "agent"
      ? { ...query, role: "admin" as const, status: "active" as const }
      : query;

  const service = createUserService(c.get("db"));
  const data = await service.list(listQuery, authUser);

  return c.json({ ok: true, data });
});

usersRoutes.post("/", writeRateLimit, validate("json", createUserSchema), async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const resolvedRole = resolveUserRoleFields(body) ?? body;

  if (resolvedRole.role === "admin" && !isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Only admins can create admin users", 403);
  }

  const db = c.get("db");
  const service = createUserService(db);
  const user = await service.create({ ...body, ...resolvedRole });

  await logAudit(db, {
    userId: authUser.id,
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: "user",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  return jsonOk(c, user, undefined, 201);
});

usersRoutes.get("/export", async (c) => {
  const denied = requireExportUsers(c);
  if (denied) return denied;

  const parsed = userExportQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid query", 400, parsed.error.flatten());
  }

  const authUser = c.get("authUser");
  const service = createUserService(c.get("db"));
  const csv = await service.exportCsv(parsed.data, authUser);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="users-${date}.csv"`,
    },
  });
});

usersRoutes.get("/:id", validate("param", uuidParamSchema), async (c) => {
  const denied = requireViewUsers(c);
  if (denied) return denied;

  const { id } = c.req.valid("param");
  const service = createUserService(c.get("db"));
  const user = await service.getById(id);

  return jsonOk(c, user);
});

usersRoutes.delete("/:id", validate("param", uuidParamSchema), async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  return jsonError(
    c,
    "METHOD_NOT_ALLOWED",
    "User deletion is not supported. Deactivate users via PATCH instead.",
    405,
  );
});

usersRoutes.patch(
  "/:id/password",
  writeRateLimit,
  validate("param", uuidParamSchema),
  validate("json", resetUserPasswordSchema),
  async (c) => {
    const denied = requireAdmin(c);
    if (denied) return denied;

    const authUser = c.get("authUser");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");
    const service = createUserService(db);
    const existing = await service.getById(id);
    const user = await service.resetPassword(id, body);

    await logAudit(db, {
      userId: authUser.id,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      entityType: "user",
      entityId: id,
      metadata: { email: existing.email },
    });

    return jsonOk(c, user);
  },
);

usersRoutes.patch(
  "/:id",
  writeRateLimit,
  validate("param", uuidParamSchema),
  validate("json", updateUserSchema),
  async (c) => {
    const denied = requireUpdateUser(c);
    if (denied) return denied;

    const authUser = c.get("authUser");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const resolvedRole = resolveUserRoleFields(body);
    const payload = resolvedRole ? { ...body, ...resolvedRole } : body;

    if (payload.role === "admin" && !isAdmin(authUser)) {
      return jsonError(c, "FORBIDDEN", "Only admins can assign the Admin role", 403);
    }

    const db = c.get("db");
    const service = createUserService(db);
    const existing = await service.getById(id);
    const user = await service.update(id, payload, authUser.id);

    if (payload.role !== undefined && payload.role !== existing.role) {
      await logAudit(db, {
        userId: authUser.id,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        entityType: "user",
        entityId: id,
        metadata: { from: existing.role, to: payload.role },
      });
    }

    if (payload.isActive !== undefined && payload.isActive !== existing.isActive) {
      await logAudit(db, {
        userId: authUser.id,
        action: payload.isActive ? AUDIT_ACTIONS.USER_ACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED,
        entityType: "user",
        entityId: id,
        metadata: { from: existing.isActive, to: payload.isActive },
      });
    }

    return jsonOk(c, user);
  },
);
