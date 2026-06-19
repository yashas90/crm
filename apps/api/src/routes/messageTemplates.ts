import { Hono } from "hono";
import { isAdmin } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import {
  createMessageTemplateBodySchema,
  listMessageTemplatesQuerySchema,
  updateMessageTemplateBodySchema,
} from "../lib/validators/messageTemplates.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { createMessageTemplateService } from "../services/messageTemplateService.js";

export const messageTemplatesRoutes = new Hono();

function canManageMessageTemplates(user: AuthUser): boolean {
  return isAdmin(user) || user.role === "manager";
}

messageTemplatesRoutes.get("/", validate("query", listMessageTemplatesQuerySchema), async (c) => {
  const authUser = c.get("authUser");
  const { all } = c.req.valid("query");
  const service = createMessageTemplateService(c.get("db"));

  if (all && !canManageMessageTemplates(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  const items = all ? await service.listAll() : await service.listActive();
  return jsonOk(c, { items });
});

messageTemplatesRoutes.post(
  "/",
  writeRateLimit,
  validate("json", createMessageTemplateBodySchema),
  async (c) => {
    const authUser = c.get("authUser");
    if (!canManageMessageTemplates(authUser)) {
      return jsonError(c, "FORBIDDEN", "Only admins and managers can create templates", 403);
    }

    const body = c.req.valid("json");
    const service = createMessageTemplateService(c.get("db"));
    const created = await service.create({ ...body, createdBy: authUser.id });
    return jsonOk(c, created, undefined, 201);
  },
);

messageTemplatesRoutes.patch(
  "/:id",
  writeRateLimit,
  validate("json", updateMessageTemplateBodySchema),
  async (c) => {
    const authUser = c.get("authUser");
    if (!canManageMessageTemplates(authUser)) {
      return jsonError(c, "FORBIDDEN", "Only admins and managers can edit templates", 403);
    }

    const id = c.req.param("id");
    if (!id) {
      return jsonError(c, "VALIDATION_ERROR", "Missing template id", 400);
    }
    const body = c.req.valid("json");
    const service = createMessageTemplateService(c.get("db"));
    const updated = await service.update(id, body);
    if (!updated) {
      return jsonError(c, "NOT_FOUND", "Template not found", 404);
    }
    return jsonOk(c, updated);
  },
);

messageTemplatesRoutes.delete("/:id", writeRateLimit, async (c) => {
  const authUser = c.get("authUser");
  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Only admins can deactivate templates", 403);
  }

  const id = c.req.param("id");
  if (!id) {
    return jsonError(c, "VALIDATION_ERROR", "Missing template id", 400);
  }
  const service = createMessageTemplateService(c.get("db"));
  const updated = await service.deactivate(id);
  if (!updated) {
    return jsonError(c, "NOT_FOUND", "Template not found", 404);
  }
  return jsonOk(c, updated);
});
