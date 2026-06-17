import { Hono } from "hono";
import { z } from "zod";
import { AUDIT_ACTIONS } from "../lib/auditActions.js";
import { jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { auditFromContext } from "../services/auditService.js";

export const securityRoutes = new Hono();

const deviceEventSchema = z.object({
  event: z.enum(["jailbreak_detected"]),
  device: z.object({
    platform: z.string(),
    isJailBroken: z.boolean(),
    canMockLocation: z.boolean().optional(),
    trustFall: z.boolean().optional(),
    isOnExternalStorage: z.boolean().optional(),
  }),
});

securityRoutes.post("/device-event", validate("json", deviceEventSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const payload = c.req.valid("json");

  await auditFromContext(c, c.get("db"), {
    userId: authUser.id,
    action: AUDIT_ACTIONS.DEVICE_SECURITY_VIOLATION,
    entityType: "device",
    entityId: authUser.id,
    entityName: authUser.name,
    metadata: {
      event: payload.event,
      device: payload.device,
    },
  });

  return jsonOk(c, { logged: true });
});
