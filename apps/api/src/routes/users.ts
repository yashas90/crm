import { Hono } from "hono";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { uuidParamSchema } from "../lib/validators/common.js";
import { listUsersQuerySchema, updateUserSchema } from "../lib/validators/users.js";
import { createUserService } from "../services/userService.js";

export const usersRoutes = new Hono();

usersRoutes.get("/", validate("query", listUsersQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const authUser = c.get("authUser");
  const service = createUserService(c.get("db"));
  const result = await service.list(query);

  return jsonOk(c, result.rows, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  });
});

usersRoutes.get("/:id", validate("param", uuidParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  const authUser = c.get("authUser");
  const service = createUserService(c.get("db"));
  const user = await service.getById(id);

  return jsonOk(c, user);
});

usersRoutes.patch("/:id", validate("param", uuidParamSchema), async (c) => {
  const authUser = c.get("authUser");

  if (authUser.role !== "admin") {
    return jsonError(c, "FORBIDDEN", "Only admins can update users", 403);
  }

  const { id } = c.req.valid("param");
  const body = await c.req.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
  }

  const service = createUserService(c.get("db"));
  const user = await service.update(id, parsed.data);

  return jsonOk(c, user);
});
