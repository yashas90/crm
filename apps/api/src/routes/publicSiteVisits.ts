import { Hono } from "hono";
import { z } from "zod";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import {
  CustomerPortalActionError,
  siteVisitPublicService,
} from "../services/siteVisitPublicService.js";

export const publicSiteVisitsRoutes = new Hono();

const visitTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be HH:MM or HH:MM:SS");

const rescheduleSchema = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitTime: visitTimeSchema,
});

publicSiteVisitsRoutes.get("/:token", async (c) => {
  const token = c.req.param("token");
  if (!token) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
  const visit = await siteVisitPublicService.getByToken(token);
  if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
  return jsonOk(c, visit);
});

publicSiteVisitsRoutes.post(
  "/:token/reschedule",
  writeRateLimit,
  validate("json", rescheduleSchema),
  async (c) => {
    const token = c.req.param("token");
    if (!token) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    const body = c.req.valid("json");
    try {
      const visit = await siteVisitPublicService.reschedule(token, body);
      if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
      return jsonOk(c, visit);
    } catch (error) {
      if (error instanceof CustomerPortalActionError) {
        const status = error.code === "VISIT_OVERLAP" ? 409 : 400;
        return jsonError(c, error.code, error.message, status);
      }
      throw error;
    }
  },
);

publicSiteVisitsRoutes.post("/:token/cancel", writeRateLimit, async (c) => {
  const token = c.req.param("token");
  if (!token) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
  try {
    const visit = await siteVisitPublicService.cancel(token);
    if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    return jsonOk(c, visit);
  } catch (error) {
    if (error instanceof CustomerPortalActionError) {
      return jsonError(c, error.code, error.message, 400);
    }
    throw error;
  }
});
