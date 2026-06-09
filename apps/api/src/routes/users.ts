import { Hono } from "hono";
import type { Context } from "hono";
import { canCreateUsers, canUpdateUsers, canViewUsers, isAdmin } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { resolveUserRoleFields } from "../lib/role-mapping.js";
import { validate } from "../lib/validate.js";
import { uuidParamSchema } from "../lib/validators/common.js";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userExportQuerySchema,
  userScopeCountsQuerySchema,
} from "../lib/validators/users.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { createUserService } from "../services/userService.js";

export const usersRoutes = new Hono();

function requireCreateUser(c: Context) {
  const authUser = c.get("authUser");
  if (!canCreateUsers(authUser)) {
    return jsonError(c, "FORBIDDEN", "You cannot create users", 403);
  }
  return null;
}

function requireUpdateUser(c: Context) {
  const authUser = c.get("authUser");
  if (!canUpdateUsers(authUser)) {
    return jsonError(c, "FORBIDDEN", "You cannot update users", 403);
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

usersRoutes.get("/scope-counts", async (c) => {
  const denied = requireViewUsers(c);
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
  const denied = requireViewUsers(c);
  if (denied) return denied;

  const query = c.req.valid("query");
  const service = createUserService(c.get("db"));
  const data = await service.list(query);

  return c.json({ ok: true, data });
});

usersRoutes.post("/", writeRateLimit, validate("json", createUserSchema), async (c) => {
  const denied = requireCreateUser(c);
  if (denied) return denied;

  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  // roleLabel -> users.role enum is applied in createUserSchema; guard admin assignment here.
  const resolvedRole = resolveUserRoleFields(body) ?? body;

  if (resolvedRole.role === "admin" && !isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Only admins can create admin users", 403);
  }

  const service = createUserService(c.get("db"));
  const user = await service.create({ ...body, ...resolvedRole });

  return jsonOk(c, user, undefined, 201);
});

usersRoutes.get("/export", async (c) => {
  const denied = requireViewUsers(c);
  if (denied) return denied;

  const parsed = userExportQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid query", 400, parsed.error.flatten());
  }

  const service = createUserService(c.get("db"));
  const csv = await service.exportCsv(parsed.data);
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
    // When the form sends roleLabel, derive users.role for auth/permissions before persisting.
    const resolvedRole = resolveUserRoleFields(body);
    const payload = resolvedRole ? { ...body, ...resolvedRole } : body;

    if (payload.role === "admin" && !isAdmin(authUser)) {
      return jsonError(c, "FORBIDDEN", "Only admins can assign the Admin role", 403);
    }

    const service = createUserService(c.get("db"));
    const user = await service.update(id, payload, authUser.id);

    return jsonOk(c, user);
  },
);
