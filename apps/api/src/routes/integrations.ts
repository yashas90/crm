import { Hono } from "hono";
import { getIntegrationsStatus } from "../lib/integrationsStatus.js";
import { canViewOrgProfile } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";

export const integrationsRoutes = new Hono();

integrationsRoutes.get("/status", async (c) => {
  const authUser = c.get("authUser");
  if (!canViewOrgProfile(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  return jsonOk(c, await getIntegrationsStatus());
});
