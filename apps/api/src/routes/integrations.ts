import { Hono } from "hono";
import { syncGoogleAdsLeads } from "../jobs/googleAdsLeadJob.js";
import { getIntegrationsStatus } from "../lib/integrationsStatus.js";
import { canViewOrgProfile, isAdmin } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { writeRateLimit } from "../middleware/rateLimit.js";

export const integrationsRoutes = new Hono();

integrationsRoutes.get("/status", async (c) => {
  const authUser = c.get("authUser");
  if (!canViewOrgProfile(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  return jsonOk(c, await getIntegrationsStatus());
});

integrationsRoutes.post("/google/poll", writeRateLimit, async (c) => {
  const authUser = c.get("authUser");
  if (!isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin only", 403);
  }

  const result = await syncGoogleAdsLeads();
  return jsonOk(c, result);
});
