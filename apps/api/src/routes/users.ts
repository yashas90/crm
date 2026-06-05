import { Hono } from "hono";
import type { Context } from "hono";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { uuidParamSchema } from "../lib/validators/common.js";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from "../lib/validators/users.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { createUserService } from "../services/userService.js";

export const usersRoutes = new Hono();

function requireAdmin(c: Context) {
  const authUser = c.get("authUser");
  if (authUser.role !== "admin") {
    return jsonError(c, "FORBIDDEN", "Only admins can manage users", 403);
  }
  return null;
}

usersRoutes.get("/", validate("query", listUsersQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const service = createUserService(c.get("db"));
  const result = await service.list(query);

  return jsonOk(c, result.rows, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  });
});

usersRoutes.post("/", writeRateLimit, validate("json", createUserSchema), async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  const body = c.req.valid("json");
  const service = createUserService(c.get("db"));
  const user = await service.create(body);

  return jsonOk(c, user, undefined, 201);
});

usersRoutes.get("/:id", validate("param", uuidParamSchema), async (c) => {
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
    const denied = requireAdmin(c);
    if (denied) return denied;

    const authUser = c.get("authUser");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const service = createUserService(c.get("db"));
    const user = await service.update(id, body, authUser.id);

    return jsonOk(c, user);
  },
);
