import { tcfConsents } from "@propninja/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { canEditLead, canViewLead, forbiddenResponse } from "../lib/permissions.js";
import { jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { leadIdParamSchema, uuidParamSchema } from "../lib/validators/common.js";
import {
  createTcfConsentBodySchema,
  leadIdSnakeParamSchema,
  revokeTcfConsentBodySchema,
  upsertTcfConsentBodySchema,
} from "../lib/validators/tcf.js";
import type { AuthUser } from "../middleware/auth.js";
import { logAudit } from "../services/auditService.js";
import { leadService } from "../services/leadService.js";
import { createTcfService } from "../services/tcfService.js";

export const tcfRoutes = new Hono();

type LeadAccessResult = { response: Response } | { response: null };

async function requireLeadView(c: Context, leadId: string): Promise<LeadAccessResult> {
  const authUser = c.get("authUser") as AuthUser;
  const lead = await leadService.getLeadById(leadId);

  if (!lead) {
    return {
      response: c.json({ ok: false, error: { code: "NOT_FOUND", message: "Lead not found" } }, 404),
    };
  }

  if (!canViewLead(authUser, { assignedTo: lead.assignedTo })) {
    return { response: c.json(forbiddenResponse(), 403) };
  }

  return { response: null };
}

async function requireLeadEdit(c: Context, leadId: string): Promise<LeadAccessResult> {
  const authUser = c.get("authUser") as AuthUser;
  const lead = await leadService.getLeadById(leadId);

  if (!lead) {
    return {
      response: c.json({ ok: false, error: { code: "NOT_FOUND", message: "Lead not found" } }, 404),
    };
  }

  if (!canEditLead(authUser, { assignedTo: lead.assignedTo })) {
    return { response: c.json(forbiddenResponse(), 403) };
  }

  return { response: null };
}

tcfRoutes.post("/consent", validate("json", upsertTcfConsentBodySchema), async (c) => {
  const body = c.req.valid("json");
  const access = await requireLeadEdit(c, body.lead_id);
  if (access.response) return access.response;

  const authUser = c.get("authUser");
  const db = c.get("db");
  const service = createTcfService(db);
  const consent = await service.upsert(body);

  await logAudit(db, {
    userId: authUser.id,
    action: "TCF_CONSENT_CHANGED",
    entityType: "tcf_consent",
    entityId: body.lead_id,
    metadata: {
      leadId: body.lead_id,
      consentType: body.consent_type,
      consented: body.consented,
      consentId: consent.id,
    },
  });

  return jsonOk(c, consent, undefined, 201);
});

tcfRoutes.get("/consent/:lead_id", validate("param", leadIdSnakeParamSchema), async (c) => {
  const { lead_id } = c.req.valid("param");
  const access = await requireLeadView(c, lead_id);
  if (access.response) return access.response;

  const service = createTcfService(c.get("db"));
  const consents = await service.getByChannel(lead_id);

  return jsonOk(c, consents);
});

tcfRoutes.get("/leads/:leadId", validate("param", leadIdParamSchema), async (c) => {
  const { leadId } = c.req.valid("param");
  const access = await requireLeadView(c, leadId);
  if (access.response) return access.response;

  const service = createTcfService(c.get("db"));
  const consents = await service.listByLead(leadId);

  return jsonOk(c, consents);
});

tcfRoutes.post("/", validate("json", createTcfConsentBodySchema), async (c) => {
  const body = c.req.valid("json");
  const access = await requireLeadEdit(c, body.leadId);
  if (access.response) return access.response;

  const authUser = c.get("authUser");
  const db = c.get("db");
  const service = createTcfService(db);
  const consent = await service.create(body);

  await logAudit(db, {
    userId: authUser.id,
    action: "TCF_CONSENT_CREATED",
    entityType: "tcf_consent",
    entityId: consent.id,
    metadata: {
      leadId: body.leadId,
      consentType: body.consentType,
      consented: body.consented,
    },
  });

  return jsonOk(c, consent, undefined, 201);
});

tcfRoutes.post(
  "/:id/revoke",
  validate("param", uuidParamSchema),
  validate("json", revokeTcfConsentBodySchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const [consentRow] = await db
      .select({ leadId: tcfConsents.leadId })
      .from(tcfConsents)
      .where(eq(tcfConsents.id, id))
      .limit(1);

    if (!consentRow) {
      return c.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Consent record not found" } },
        404,
      );
    }

    const access = await requireLeadEdit(c, consentRow.leadId);
    if (access.response) return access.response;

    const authUser = c.get("authUser");
    const service = createTcfService(db);
    const consent = await service.revoke(id, body);

    await logAudit(db, {
      userId: authUser.id,
      action: "TCF_CONSENT_REVOKED",
      entityType: "tcf_consent",
      entityId: id,
      metadata: {
        leadId: consent.leadId,
        consentType: consent.consentType,
      },
    });

    return jsonOk(c, consent);
  },
);
