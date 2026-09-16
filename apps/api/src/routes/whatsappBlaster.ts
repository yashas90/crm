import { Hono } from "hono";
import { forbiddenResponse, isAdmin } from "../lib/permissions.js";
import { jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import {
  assignBodySchema,
  createCampaignBodySchema,
  parseContactsBodySchema,
  replaceContactsBodySchema,
  replyBodySchema,
  saveTemplateBodySchema,
  updateCampaignBodySchema,
} from "../lib/validators/whatsappBlaster.js";
import type { AuthUser } from "../middleware/auth.js";
import { whatsappBlasterService } from "../services/whatsappBlasterService.js";

export const whatsappBlasterRoute = new Hono();

whatsappBlasterRoute.use("*", async (c, next) => {
  const authUser = c.get("authUser") as AuthUser | undefined;
  if (!authUser || !isAdmin(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }
  await next();
});

whatsappBlasterRoute.get("/provider", (c) => {
  return jsonOk(c, whatsappBlasterService.providerInfo());
});

whatsappBlasterRoute.get("/unread-count", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const count = await whatsappBlasterService.unreadCount(authUser.id, authUser.role);
  return jsonOk(c, { count });
});

whatsappBlasterRoute.post("/parse", validate("json", parseContactsBodySchema), async (c) => {
  const body = c.req.valid("json");
  if (body.fileBase64) {
    const buffer = Buffer.from(body.fileBase64, "base64");
    return jsonOk(
      c,
      whatsappBlasterService.parseContactsFromFile(
        buffer,
        body.fileName ?? "upload.csv",
        body.mapping,
      ),
    );
  }
  if (!body.csvText?.trim()) {
    return c.json(
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "csvText or fileBase64 is required" },
      },
      400,
    );
  }
  return jsonOk(c, whatsappBlasterService.parseContactsFromText(body.csvText, body.mapping));
});

whatsappBlasterRoute.get("/templates", async (c) => {
  const items = await whatsappBlasterService.listTemplates();
  return jsonOk(c, { items });
});

whatsappBlasterRoute.post("/templates", validate("json", saveTemplateBodySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");
  const template = await whatsappBlasterService.saveTemplate({ ...body, createdBy: authUser.id });
  return jsonOk(c, template, undefined, 201);
});

whatsappBlasterRoute.delete("/templates/:id", async (c) => {
  await whatsappBlasterService.deleteTemplate(c.req.param("id"));
  return jsonOk(c, { deleted: true });
});

whatsappBlasterRoute.get("/campaigns", async (c) => {
  const items = await whatsappBlasterService.listCampaigns();
  return jsonOk(c, { items });
});

whatsappBlasterRoute.post("/campaigns", validate("json", createCampaignBodySchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");
  const campaign = await whatsappBlasterService.createCampaign({ ...body, createdBy: authUser.id });
  return jsonOk(c, campaign, undefined, 201);
});

whatsappBlasterRoute.get("/campaigns/:id", async (c) => {
  const campaign = await whatsappBlasterService.getCampaign(c.req.param("id"));
  return jsonOk(c, campaign);
});

whatsappBlasterRoute.patch(
  "/campaigns/:id",
  validate("json", updateCampaignBodySchema),
  async (c) => {
    const campaign = await whatsappBlasterService.updateCampaign(
      c.req.param("id"),
      c.req.valid("json"),
    );
    return jsonOk(c, campaign);
  },
);

whatsappBlasterRoute.post(
  "/campaigns/:id/contacts",
  validate("json", replaceContactsBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    const parsed =
      body.contacts ??
      (body.fileBase64
        ? whatsappBlasterService.parseContactsFromFile(
            Buffer.from(body.fileBase64, "base64"),
            body.fileName ?? "upload.csv",
            body.mapping,
          ).contacts
        : whatsappBlasterService.parseContactsFromText(body.csvText ?? "", body.mapping).contacts);
    const result = await whatsappBlasterService.replaceContacts(c.req.param("id"), parsed);
    return jsonOk(c, result);
  },
);

whatsappBlasterRoute.get("/campaigns/:id/contacts", async (c) => {
  const items = await whatsappBlasterService.listContacts(c.req.param("id"));
  return jsonOk(c, { items });
});

whatsappBlasterRoute.post("/campaigns/:id/start", async (c) => {
  return jsonOk(c, await whatsappBlasterService.startCampaign(c.req.param("id")));
});

whatsappBlasterRoute.post("/campaigns/:id/pause", async (c) => {
  return jsonOk(c, await whatsappBlasterService.pauseCampaign(c.req.param("id")));
});

whatsappBlasterRoute.post("/campaigns/:id/resume", async (c) => {
  return jsonOk(c, await whatsappBlasterService.resumeCampaign(c.req.param("id")));
});

whatsappBlasterRoute.post("/campaigns/:id/stop", async (c) => {
  return jsonOk(c, await whatsappBlasterService.stopCampaign(c.req.param("id")));
});

whatsappBlasterRoute.get("/campaigns/:id/export", async (c) => {
  const csv = await whatsappBlasterService.exportCampaignCsv(c.req.param("id"));
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="whatsapp-campaign.csv"`,
  });
});

whatsappBlasterRoute.get("/campaigns/:id/report", async (c) => {
  return jsonOk(c, await whatsappBlasterService.campaignReport(c.req.param("id")));
});

whatsappBlasterRoute.get("/campaigns/:id/report.pdf", async (c) => {
  const pdf = await whatsappBlasterService.exportReportPdf(c.req.param("id"));
  return c.body(new Uint8Array(pdf), 200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="whatsapp-campaign-report.pdf"`,
  });
});

whatsappBlasterRoute.get("/inbox", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const items = await whatsappBlasterService.listInbox(authUser.id, authUser.role);
  return jsonOk(c, { items });
});

whatsappBlasterRoute.get("/inbox/:contactId", async (c) => {
  return jsonOk(c, await whatsappBlasterService.listMessages(c.req.param("contactId")));
});

whatsappBlasterRoute.post(
  "/inbox/:contactId/reply",
  validate("json", replyBodySchema),
  async (c) => {
    const message = await whatsappBlasterService.replyToContact(
      c.req.param("contactId"),
      c.req.valid("json").text,
    );
    return jsonOk(c, message);
  },
);

whatsappBlasterRoute.post("/inbox/:contactId/interested", async (c) => {
  return jsonOk(c, await whatsappBlasterService.markInterested(c.req.param("contactId")));
});

whatsappBlasterRoute.post("/inbox/:contactId/not-interested", async (c) => {
  await whatsappBlasterService.markNotInterested(c.req.param("contactId"));
  return jsonOk(c, { ok: true });
});

whatsappBlasterRoute.post(
  "/inbox/:contactId/assign",
  validate("json", assignBodySchema),
  async (c) => {
    await whatsappBlasterService.assignContact(
      c.req.param("contactId"),
      c.req.valid("json").agentId,
    );
    return jsonOk(c, { ok: true });
  },
);

whatsappBlasterRoute.get("/leads", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const items = await whatsappBlasterService.listWhatsAppLeads(authUser.id, authUser.role);
  return jsonOk(c, { items });
});

whatsappBlasterRoute.get("/leads/:id", async (c) => {
  return jsonOk(c, await whatsappBlasterService.getWhatsAppLead(c.req.param("id")));
});

whatsappBlasterRoute.post("/leads/:id/convert", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return jsonOk(
    c,
    await whatsappBlasterService.convertWhatsAppLead(c.req.param("id"), authUser.id),
  );
});

whatsappBlasterRoute.get("/reports", async (c) => {
  return jsonOk(c, await whatsappBlasterService.reportsSummary());
});
