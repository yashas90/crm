import { Hono } from "hono";
import { z } from "zod";
import {
  MultipartFileTooLargeError,
  MultipartValidationError,
  parseDocumentMultipart,
} from "../lib/multipartUpload.js";
import { isAdmin } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  adminCallingOverview,
  adminLeadsOverview,
  exportLeadsCsv,
  listAgentLeads,
  listCallingData,
  reassignLead,
} from "../services/callingDataService.js";
import { agentRangeReport, overallReport, poolReport } from "../services/contactPoolReports.js";
import {
  agentPerformance,
  blacklistPhone,
  bulkPoolAction,
  deleteBatch,
  exportContactsCsv,
  getBatch,
  getPoolSettings,
  invalidRowsCsv,
  listBatches,
  listPool,
  poolStats,
  reclaimContacts,
  setAgentLimit,
  setPause,
  updateBatch,
  updatePoolSettings,
} from "../services/contactPoolService.js";
import { acceptContactUpload } from "../services/contactUploadService.js";

export const contactPoolAdminRoutes = new Hono();

contactPoolAdminRoutes.use("*", async (c, next) => {
  const authUser = c.get("authUser") as AuthUser | undefined;
  if (!authUser || !isAdmin(authUser)) {
    return jsonError(c, "FORBIDDEN", "Admin access required", 403);
  }
  await next();
});

const poolQuery = z.object({
  status: z.string().optional(),
  city: z.string().optional(),
  agentId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  propertyType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

contactPoolAdminRoutes.post("/upload-contacts", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  try {
    const parsed = await parseDocumentMultipart(c.req.raw, 15 * 1024 * 1024);
    const data = await acceptContactUpload({
      adminId: authUser.id,
      filename: parsed.file.filename,
      buffer: parsed.file.buffer,
      batchName: parsed.fields.batchName || parsed.fields.batch_name,
    });
    return jsonOk(c, data, undefined, 202);
  } catch (error) {
    if (error instanceof MultipartValidationError || error instanceof MultipartFileTooLargeError) {
      return jsonError(c, "BAD_REQUEST", error.message, 400);
    }
    throw error;
  }
});

contactPoolAdminRoutes.get("/upload-batches", async (c) => {
  return jsonOk(c, await listBatches());
});

contactPoolAdminRoutes.get("/upload-batches/:id/invalid", async (c) => {
  const csv = await invalidRowsCsv(c.req.param("id"));
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="invalid-rows.csv"',
  });
});

contactPoolAdminRoutes.get("/upload-batches/:id", async (c) => {
  return jsonOk(c, await getBatch(c.req.param("id")));
});

contactPoolAdminRoutes.delete("/upload-batches/:id", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  return jsonOk(c, await deleteBatch(c.req.param("id"), authUser.id));
});

contactPoolAdminRoutes.patch(
  "/upload-batches/:id",
  validate(
    "json",
    z.object({
      batchName: z.string().min(1).max(120).optional(),
      priority: z.number().int().min(0).max(100).optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json");
    return jsonOk(c, await updateBatch(c.req.param("id"), body));
  },
);

contactPoolAdminRoutes.get("/contact-pool", validate("query", poolQuery), async (c) => {
  return jsonOk(c, await listPool(c.req.valid("query")));
});

contactPoolAdminRoutes.get("/pool-stats", async (c) => {
  return jsonOk(c, await poolStats());
});

contactPoolAdminRoutes.get("/agent-stats", async (c) => {
  return jsonOk(c, await agentPerformance());
});

contactPoolAdminRoutes.put(
  "/agent-limit/:id",
  validate("json", z.object({ maxDailyLimit: z.number().int().min(1).max(100) })),
  async (c) => {
    const body = c.req.valid("json");
    return jsonOk(c, await setAgentLimit(c.req.param("id"), body.maxDailyLimit));
  },
);

contactPoolAdminRoutes.post(
  "/reclaim-contacts",
  validate("json", z.object({ agentId: z.string().uuid() })),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const body = c.req.valid("json");
    return jsonOk(c, await reclaimContacts(authUser.id, body.agentId));
  },
);

contactPoolAdminRoutes.post(
  "/pause-requests",
  validate("json", z.object({ paused: z.boolean() })),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const body = c.req.valid("json");
    return jsonOk(c, await setPause(authUser.id, body.paused));
  },
);

contactPoolAdminRoutes.get("/pool-settings", async (c) => {
  return jsonOk(c, await getPoolSettings());
});

contactPoolAdminRoutes.put(
  "/pool-settings",
  validate(
    "json",
    z.object({
      costPerContact: z.number().nonnegative().nullable().optional(),
      lowPoolThreshold: z.number().int().min(1).max(100000).optional(),
    }),
  ),
  async (c) => jsonOk(c, await updatePoolSettings(c.req.valid("json"))),
);

contactPoolAdminRoutes.get("/export-contacts", async (c) => {
  const csv = await exportContactsCsv({
    status: c.req.query("status"),
    city: c.req.query("city"),
    agentId: c.req.query("agentId"),
    batchId: c.req.query("batchId"),
  });
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="contact-pool.csv"',
  });
});

contactPoolAdminRoutes.post(
  "/contact-pool/bulk",
  validate(
    "json",
    z.object({
      action: z.enum(["reassign", "dnc", "delete"]),
      contactIds: z.array(z.string().uuid()).min(1).max(500),
      agentId: z.string().uuid().optional(),
    }),
  ),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    return jsonOk(c, await bulkPoolAction(authUser.id, c.req.valid("json")));
  },
);

contactPoolAdminRoutes.post(
  "/blacklist",
  validate(
    "json",
    z.object({ phone: z.string().min(5).max(32), reason: z.string().max(200).optional() }),
  ),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const body = c.req.valid("json");
    return jsonOk(c, await blacklistPhone(authUser.id, body.phone, body.reason));
  },
);

contactPoolAdminRoutes.get("/pool-report", async (c) => jsonOk(c, await poolReport()));

contactPoolAdminRoutes.get("/overall-report", async (c) => {
  const range = c.req.query("range");
  const preset = range === "week" || range === "month" ? range : "day";
  return jsonOk(c, await overallReport(preset));
});

contactPoolAdminRoutes.get("/agent-report/:id", async (c) => {
  const range = c.req.query("range");
  const preset = range === "week" || range === "month" ? range : "day";
  return jsonOk(c, await agentRangeReport(c.req.param("id"), preset));
});

contactPoolAdminRoutes.get("/calling-overview", async (c) => {
  return jsonOk(c, await adminCallingOverview());
});

contactPoolAdminRoutes.get("/leads-overview", async (c) => {
  return jsonOk(c, await adminLeadsOverview());
});

contactPoolAdminRoutes.get("/agent-calling-data", async (c) => {
  const agentId = c.req.query("agentId");
  if (!agentId) return jsonError(c, "BAD_REQUEST", "agentId is required", 400);
  return jsonOk(
    c,
    await listCallingData({ agentId, search: c.req.query("search"), asAdmin: true }),
  );
});

contactPoolAdminRoutes.get("/qualified-leads", async (c) => {
  return jsonOk(
    c,
    await listAgentLeads({
      agentId: c.req.query("agentId") ?? "",
      anyAgent: true,
      stage: c.req.query("stage"),
      priority: c.req.query("priority"),
      search: c.req.query("search"),
    }),
  );
});

contactPoolAdminRoutes.post(
  "/reassign-lead",
  validate("json", z.object({ leadId: z.string().uuid(), agentId: z.string().uuid() })),
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const body = c.req.valid("json");
    return jsonOk(c, await reassignLead(authUser.id, body.leadId, body.agentId));
  },
);

contactPoolAdminRoutes.get("/export-leads", async (c) => {
  const csv = await exportLeadsCsv(c.req.query("agentId"));
  return c.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="qualified-leads.csv"',
  });
});
