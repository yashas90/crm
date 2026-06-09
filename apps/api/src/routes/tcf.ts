import { Hono } from "hono";
import { jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { leadIdParamSchema, uuidParamSchema } from "../lib/validators/common.js";
import {
  createTcfConsentBodySchema,
  leadIdSnakeParamSchema,
  revokeTcfConsentBodySchema,
  upsertTcfConsentBodySchema,
} from "../lib/validators/tcf.js";
import { createTcfService } from "../services/tcfService.js";

export const tcfRoutes = new Hono();

tcfRoutes.post("/consent", validate("json", upsertTcfConsentBodySchema), async (c) => {
  const body = c.req.valid("json");
  const _authUser = c.get("authUser");
  const service = createTcfService(c.get("db"));
  const consent = await service.upsert(body);

  return jsonOk(c, consent, undefined, 201);
});

tcfRoutes.get("/consent/:lead_id", validate("param", leadIdSnakeParamSchema), async (c) => {
  const { lead_id } = c.req.valid("param");
  const _authUser = c.get("authUser");
  const service = createTcfService(c.get("db"));
  const consents = await service.getByChannel(lead_id);

  return jsonOk(c, consents);
});

tcfRoutes.get("/leads/:leadId", validate("param", leadIdParamSchema), async (c) => {
  const { leadId } = c.req.valid("param");
  const _authUser = c.get("authUser");
  const service = createTcfService(c.get("db"));
  const consents = await service.listByLead(leadId);

  return jsonOk(c, consents);
});

tcfRoutes.post("/", validate("json", createTcfConsentBodySchema), async (c) => {
  const body = c.req.valid("json");
  const _authUser = c.get("authUser");
  const service = createTcfService(c.get("db"));
  const consent = await service.create(body);

  return jsonOk(c, consent, undefined, 201);
});

tcfRoutes.post(
  "/:id/revoke",
  validate("param", uuidParamSchema),
  validate("json", revokeTcfConsentBodySchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const _authUser = c.get("authUser");
    const service = createTcfService(c.get("db"));
    const consent = await service.revoke(id, body);

    return jsonOk(c, consent);
  },
);
