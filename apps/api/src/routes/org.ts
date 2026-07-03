import { Hono } from "hono";
import { AUDIT_ACTIONS } from "../lib/auditActions.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { listOrgUpdateFields } from "../lib/orgSettings.js";
import { canUpdateOrgProfile, canViewOrgProfile } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { updateOrgBodySchema } from "../lib/validators/org.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { auditFromContext } from "../services/auditService.js";
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

orgRoutes.patch("/", writeRateLimit, validate("json", updateOrgBodySchema), async (c) => {
  const authUser = c.get("authUser");
  if (!canUpdateOrgProfile(authUser)) {
    return jsonError(c, "FORBIDDEN", "You cannot update organization settings", 403);
  }

  const body = c.req.valid("json");
  const db = c.get("db");
  const service = createOrgService(db);
  const org = await service.update(body);

  const updatedFields = listOrgUpdateFields(body);
  if (updatedFields.length > 0) {
    await auditFromContext(c, db, {
      userId: authUser.id,
      action: AUDIT_ACTIONS.ORG_SETTINGS_UPDATED,
      entityType: "organization",
      entityId: SINGLE_TENANT_ORG_ID,
      entityName: org.name,
      metadata: { updatedFields },
    });
  }

  return jsonOk(c, org);
});
