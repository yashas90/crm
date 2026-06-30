import { Hono } from "hono";
import { z } from "zod";
import { canEditLead } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { auditFromContext } from "../services/auditService.js";
import { leadService } from "../services/leadService.js";
import { isSmsConfigured, sendSms } from "../services/smsService.js";
import { hasLeadChannelConsent } from "../services/tcfConsentService.js";

export const smsRoutes = new Hono();

const sendSmsSchema = z.object({
  leadId: z.string().uuid(),
  message: z.string().trim().min(1).max(1600),
});

smsRoutes.post("/send", writeRateLimit, validate("json", sendSmsSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const db = c.get("db");
  const { leadId, message } = c.req.valid("json");

  if (!isSmsConfigured()) {
    return jsonError(c, "NOT_CONFIGURED", "SMS provider is not configured", 503);
  }

  const lead = await leadService.getLeadById(leadId);
  if (!lead) {
    return jsonError(c, "NOT_FOUND", "Lead not found", 404);
  }

  if (!canEditLead(authUser, { assignedTo: lead.assignedTo })) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }

  if (!lead.phone?.trim()) {
    return jsonError(c, "VALIDATION_ERROR", "Lead has no phone number", 400);
  }

  const hasConsent = await hasLeadChannelConsent(db, leadId, "sms");
  if (!hasConsent) {
    return jsonError(
      c,
      "CONSENT_REQUIRED",
      "SMS consent is required before sending messages to this lead",
      403,
    );
  }

  const result = await sendSms({ to: lead.phone, body: message });

  await auditFromContext(c, db, {
    userId: authUser.id,
    action: "SMS_SENT",
    entityType: "lead",
    entityId: leadId,
    metadata: {
      messageId: result.messageId,
      provider: result.provider,
      status: result.status,
      phoneLast4: lead.phone.slice(-4),
    },
  });

  return jsonOk(c, {
    messageId: result.messageId,
    status: result.status,
    provider: result.provider,
  });
});

smsRoutes.get("/status", async (c) => {
  return jsonOk(c, { configured: isSmsConfigured(), provider: "twilio" });
});
