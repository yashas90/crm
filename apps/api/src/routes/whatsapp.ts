import { Hono } from "hono";
import { canEditLead, canViewLead, forbiddenResponse } from "../lib/permissions.js";
import { validate } from "../lib/validate.js";
import { sendWhatsAppMessageBodySchema } from "../lib/validators/whatsapp.js";
import type { AuthUser } from "../middleware/auth.js";
import { leadService } from "../services/leadService.js";
import { whatsappService } from "../services/whatsappService.js";

export const whatsappRoute = new Hono();

whatsappRoute.get("/templates", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const all = c.req.query("all") === "true";

  if (all && authUser.role !== "admin") {
    return c.json(forbiddenResponse(), 403);
  }

  const items = all
    ? await whatsappService.listAllTemplates()
    : await whatsappService.listActiveTemplates();

  return c.json({ ok: true, data: { items } });
});

whatsappRoute.post("/templates/sync", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role !== "admin") {
    return c.json(forbiddenResponse(), 403);
  }

  if (!whatsappService.isConfigured()) {
    return c.json(
      {
        ok: false,
        error: {
          code: "NOT_CONFIGURED",
          message: "WhatsApp API is not configured on the server",
        },
      },
      503,
    );
  }

  try {
    const result = await whatsappService.syncTemplatesFromMeta();
    return c.json({ ok: true, data: result });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: {
          code: "SYNC_FAILED",
          message: error instanceof Error ? error.message : "Template sync failed",
        },
      },
      502,
    );
  }
});

whatsappRoute.post("/send", validate("json", sendWhatsAppMessageBodySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");

  const lead = await leadService.getLeadById(body.leadId);
  if (!lead) {
    return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Lead not found" } }, 404);
  }

  if (!canEditLead(authUser, lead)) {
    return c.json(forbiddenResponse(), 403);
  }

  if (!whatsappService.isConfigured()) {
    return c.json(
      {
        ok: false,
        error: {
          code: "NOT_CONFIGURED",
          message: "WhatsApp API is not configured on the server",
        },
      },
      503,
    );
  }

  try {
    const message = await whatsappService.sendTemplateMessage({
      leadId: body.leadId,
      templateId: body.templateId,
      sentBy: authUser.id,
      variables: body.variables,
    });

    return c.json({ ok: true, data: message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send WhatsApp message";
    return c.json({ ok: false, error: { code: "SEND_FAILED", message } }, 502);
  }
});
