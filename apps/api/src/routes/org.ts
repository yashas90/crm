import { Hono } from "hono";
import { canViewOrgProfile } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { createOrgService } from "../services/orgService.js";

export const orgRoutes = new Hono();

orgRoutes.get("/", async (c) => {
  const authUser = c.get("authUser");
  if (!canViewOrgProfile(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  const service = createOrgService(c.get("db"));
  const org = await service.get();

  return jsonOk(c, org);
});
