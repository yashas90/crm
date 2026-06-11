import { Hono } from "hono";
import type { Context } from "hono";
import { isAdmin } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { listAuditLogsQuerySchema } from "../lib/validators/audit.js";
import { createAuditService } from "../services/auditService.js";

export const auditLogsRoutes = new Hono();

function requireAdmin(c: Context) {
  const authUser = c.get("authUser");
  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

auditLogsRoutes.get("/", validate("query", listAuditLogsQuerySchema), async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  const query = c.req.valid("query");
  const service = createAuditService(c.get("db"));
  const items = await service.list(query);

  return jsonOk(c, { items });
});
