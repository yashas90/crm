import { Hono } from "hono";
import { z } from "zod";
import { canExportReports, canViewReports } from "../lib/permissions.js";
import {
  callsReportQuerySchema,
  dashboardReportQuerySchema,
  leadsReportQuerySchema,
  overviewReportQuerySchema,
  revenuePipelineQuerySchema,
  sourcesReportQuerySchema,
} from "../lib/validators/reports.js";
import type { AuthUser } from "../middleware/auth.js";
import { reportService } from "../services/reportService.js";
import { revenuePipelineService } from "../services/revenuePipelineService.js";

export const reportsRoutes = new Hono();

const teamTodayQuerySchema = z.object({
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

function defaultTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { dateFrom: start, dateTo: end };
}

// If an agent could access reports, user_id from query would be ignored and forced to authUser.id.
// In practice agents are blocked by requireReportsAccess (canViewReports) before handlers run.
function resolveReportUserId(authUser: AuthUser, requested?: string) {
  if (authUser.role === "agent") return authUser.id;
  return requested;
}

// canViewReports: admin/manager only; agents receive 403 on all /reports/* routes.
function requireReportsAccess(c: {
  get: (key: "authUser") => AuthUser;
  json: (body: unknown, status?: number) => Response;
}) {
  const authUser = c.get("authUser") as AuthUser;

  if (authUser.role !== "admin" && authUser.role !== "manager") {
    return c.json(
      { ok: false, error: { code: "FORBIDDEN", message: "Reports access denied" } },
      403,
    );
  }

  if (!canViewReports(authUser)) {
    return c.json(
      { ok: false, error: { code: "FORBIDDEN", message: "Reports access denied" } },
      403,
    );
  }
  return null;
}

function requireReportsExportAccess(c: {
  get: (key: "authUser") => AuthUser;
  json: (body: unknown, status?: number) => Response;
}) {
  const denied = requireReportsAccess(c);
  if (denied) return denied;

  const authUser = c.get("authUser") as AuthUser;
  if (!canExportReports(authUser)) {
    return c.json(
      { ok: false, error: { code: "FORBIDDEN", message: "Reports export denied" } },
      403,
    );
  }

  return null;
}

reportsRoutes.get("/overview", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;

  const authUser = c.get("authUser") as AuthUser;
  const parsed = overviewReportQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const data = await reportService.getOverviewStats({
    ...parsed.data,
    userId: resolveReportUserId(authUser, parsed.data.userId),
  });

  return c.json({ ok: true, data });
});

reportsRoutes.get("/projects", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;

  const data = await reportService.getProjects();
  return c.json({ ok: true, data });
});

reportsRoutes.get("/dashboard", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;
  const authUser = c.get("authUser") as AuthUser;
  const parsed = dashboardReportQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const data = await reportService.getDashboard({
    ...parsed.data,
    userId: resolveReportUserId(authUser, parsed.data.userId),
  });

  return c.json({ ok: true, data });
});

function parseCallsReportRequest(
  authUser: AuthUser,
  query: Record<string, string | string[] | undefined>,
) {
  const parsed = callsReportQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: parsed.error.flatten() as unknown };
  }

  const resolvedUserIds =
    authUser.role === "agent"
      ? [authUser.id]
      : parsed.data.userIds?.length
        ? parsed.data.userIds
        : undefined;

  const scopedQuery = {
    ...parsed.data,
    userId: resolvedUserIds ? undefined : resolveReportUserId(authUser, parsed.data.userId),
    userIds: resolvedUserIds,
    status: parsed.data.status,
  };

  return { scopedQuery, parsed: parsed.data };
}

/**
 * GET /api/reports/calls
 *
 * Default (no `group_by`): time-series analytics — calls over time, disposition/direction
 * breakdowns, and activity on leads.
 *
 * Per-user tabular report (`group_by=user`): paginated rows of call metrics per agent.
 * Response: `{ items, total, page, pageSize, totals }` where `totals` is the footer
 * aggregate across all matching users.
 *
 * Supported query params (per-user mode):
 * - `date_from`, `date_to` — ISO datetimes (call `started_at` range)
 * - `user_id`, `user_ids` — comma-separated UUIDs
 * - `user_status` — `all` | `active` | `inactive` (filters `users.is_active`)
 * - `user_name` — partial match on `users.name` (ilike)
 * - `source`, `sub_source`, `project_name`, `project_status`, `campaign_name` — lead-linked filters
 * - `with_team=true` — include direct reports of selected user(s) via `users.reporting_to_id`
 * - `page`, `page_size` — pagination (default page 1, size 50)
 *
 * CSV export: GET /api/reports/calls/export?group_by=user&… (same filters, no pagination).
 */
reportsRoutes.get("/calls/export", async (c) => {
  const denied = requireReportsExportAccess(c);
  if (denied) return denied;
  const authUser = c.get("authUser") as AuthUser;
  const result = parseCallsReportRequest(authUser, c.req.query());

  if ("error" in result) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: result.error,
        },
      },
      400,
    );
  }

  if (result.parsed.groupBy !== "user") {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Export requires group_by=user",
        },
      },
      400,
    );
  }

  const stream = await reportService.exportCallsReportPerUserCsvStream(result.scopedQuery);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calls-report-${date}.csv"`,
    },
  });
});

reportsRoutes.get("/calls", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;
  const authUser = c.get("authUser") as AuthUser;
  const result = parseCallsReportRequest(authUser, c.req.query());

  if ("error" in result) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: result.error,
        },
      },
      400,
    );
  }

  if (result.parsed.groupBy === "user") {
    const data = await reportService.getCallsReportPerUser(result.scopedQuery);
    return c.json({ ok: true, data });
  }

  const data = await reportService.getCallsReport(result.scopedQuery);

  return c.json({ ok: true, data });
});

reportsRoutes.get("/sources", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;

  const authUser = c.get("authUser") as AuthUser;
  const parsed = sourcesReportQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const data = await reportService.getSourcesReport({
    ...parsed.data,
    userId: resolveReportUserId(authUser, parsed.data.userId),
  });

  return c.json({ ok: true, data });
});

reportsRoutes.get("/leads", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;
  const authUser = c.get("authUser") as AuthUser;
  const parsed = leadsReportQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const data = await reportService.getLeadsReport({
    ...parsed.data,
    userId: resolveReportUserId(authUser, parsed.data.userId),
  });

  return c.json({ ok: true, data });
});

reportsRoutes.get("/team-today", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;

  const _authUser = c.get("authUser") as AuthUser;
  const parsed = teamTodayQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const range = defaultTodayRange();
  const dateFrom = parsed.data.date_from ? new Date(parsed.data.date_from) : range.dateFrom;
  const dateTo = parsed.data.date_to ? new Date(parsed.data.date_to) : range.dateTo;

  const data = await reportService.getTeamToday(dateFrom, dateTo);

  return c.json({ ok: true, data });
});

reportsRoutes.get("/team-today/export", async (c) => {
  const denied = requireReportsExportAccess(c);
  if (denied) return denied;

  const parsed = teamTodayQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const range = defaultTodayRange();
  const dateFrom = parsed.data.date_from ? new Date(parsed.data.date_from) : range.dateFrom;
  const dateTo = parsed.data.date_to ? new Date(parsed.data.date_to) : range.dateTo;

  const stream = await reportService.exportTeamTodayCsvStream(dateFrom, dateTo);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="team-performance-${date}.csv"`,
    },
  });
});

reportsRoutes.get("/sources/export", async (c) => {
  const denied = requireReportsExportAccess(c);
  if (denied) return denied;

  const authUser = c.get("authUser") as AuthUser;
  const parsed = sourcesReportQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const stream = await reportService.exportSourcesReportCsvStream({
    ...parsed.data,
    userId: resolveReportUserId(authUser, parsed.data.userId),
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lead-sources-${date}.csv"`,
    },
  });
});

reportsRoutes.get("/calls/analytics/export", async (c) => {
  const denied = requireReportsExportAccess(c);
  if (denied) return denied;

  const authUser = c.get("authUser") as AuthUser;
  const result = parseCallsReportRequest(authUser, c.req.query());

  if ("error" in result) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: result.error,
        },
      },
      400,
    );
  }

  if (result.parsed.groupBy === "user") {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Analytics export does not support group_by=user",
        },
      },
      400,
    );
  }

  const stream = await reportService.exportCallsAnalyticsCsvStream(result.scopedQuery);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calls-analytics-${date}.csv"`,
    },
  });
});

const agentStatsQuerySchema = z.object({
  agentId: z.string().uuid().optional(),
});

reportsRoutes.get("/agent-stats", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = agentStatsQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const requestedAgentId = parsed.data.agentId;
  if (requestedAgentId && authUser.role === "agent" && requestedAgentId !== authUser.id) {
    return c.json(
      { ok: false, error: { code: "FORBIDDEN", message: "Cannot view another agent's stats" } },
      403,
    );
  }

  const agentId = requestedAgentId ?? authUser.id;
  const data = await reportService.getAgentStats(agentId);
  return c.json({ ok: true, data });
});

reportsRoutes.get("/revenue-pipeline", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;

  const parsed = revenuePipelineQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const data = await revenuePipelineService.getRevenuePipeline(parsed.data);
  return c.json({ ok: true, data });
});

reportsRoutes.get("/revenue-pipeline/export", async (c) => {
  const denied = requireReportsExportAccess(c);
  if (denied) return denied;

  const parsed = revenuePipelineQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const stream = await revenuePipelineService.exportCsv(parsed.data);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="revenue-pipeline-${date}.csv"`,
    },
  });
});
