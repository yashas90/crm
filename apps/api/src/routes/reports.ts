import { Hono } from "hono";
import { z } from "zod";
import { canViewReports } from "../lib/permissions.js";
import {
  callsReportQuerySchema,
  dashboardReportQuerySchema,
  leadsReportQuerySchema,
} from "../lib/validators/reports.js";
import type { AuthUser } from "../middleware/auth.js";
import { reportService } from "../services/reportService.js";

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
  if (!canViewReports(authUser)) {
    return c.json(
      { ok: false, error: { code: "FORBIDDEN", message: "Reports access denied" } },
      403,
    );
  }
  return null;
}

reportsRoutes.get("/overview", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;

  const data = await reportService.getOverviewStats();
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

reportsRoutes.get("/calls", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;
  const authUser = c.get("authUser") as AuthUser;
  const parsed = callsReportQuerySchema.safeParse(c.req.query());

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

  const data = await reportService.getCallsReport({
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

  const data = await reportService.getLeadsReport(parsed.data);

  return c.json({ ok: true, data });
});

reportsRoutes.get("/team-today", async (c) => {
  const denied = requireReportsAccess(c);
  if (denied) return denied;

  const authUser = c.get("authUser") as AuthUser;
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
