import { Hono } from "hono";
import type { Context } from "hono";
import { hasPermission } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { createUserService } from "../services/userService.js";

export const userRolesRoutes = new Hono();

function requireViewUserRoles(c: Context) {
  const authUser = c.get("authUser");
  if (!hasPermission(authUser, "user_roles:view")) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

userRolesRoutes.get("/", async (c) => {
  const denied = requireViewUserRoles(c);
  if (denied) return denied;

  const service = createUserService(c.get("db"));
  const roles = await service.listRoles();

  return jsonOk(c, roles);
});
