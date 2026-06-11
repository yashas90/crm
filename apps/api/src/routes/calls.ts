import { Hono } from "hono";
import { z } from "zod";
import type { AuthUser } from "../middleware/auth.js";
import { callsLogRateLimit } from "../middleware/rateLimit.js";
import { callService } from "../services/callService.js";

export const callsRoute = new Hono();

const logCallSchema = z.object({
  lead_id: z.string().uuid().optional(),
  phone_number: z.string().min(5),
  direction: z.enum(["incoming", "outgoing"]),
  status: z.enum(["completed", "missed", "rejected", "failed"]),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  duration_seconds: z.number().int().nonnegative(),
  disposition: z.string().min(1),
  notes: z.string().optional(),
  source: z.enum(["mobile-manual", "mobile-auto"]),
});

const listCallsQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  direction: z.enum(["incoming", "outgoing"]).optional(),
  status: z.enum(["completed", "missed", "rejected", "failed"]).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

const summaryQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

// Call logging is mobile-only (SIM dialer). Web clients read via GET / and GET /summary.
callsRoute.post("/log", callsLogRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = await c.req.json();
  const parsed = logCallSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid body",
          details: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const data = parsed.data;
  const record = await callService.logCall({
    userId: authUser.id,
    leadId: data.lead_id,
    phoneNumber: data.phone_number,
    direction: data.direction,
    status: data.status,
    startedAt: new Date(data.started_at),
    endedAt: new Date(data.ended_at),
    durationSeconds: data.duration_seconds,
    disposition: data.disposition,
    notes: data.notes,
    source: data.source,
  });

  return c.json({ ok: true, data: record }, 201);
});

// List calls: agents always scoped to own user_id (query user_id ignored);
// managers/admins may filter by user_id.
callsRoute.get("/", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = listCallsQuerySchema.safeParse(c.req.query());

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

  const q = parsed.data;
  // Agents may only list their own calls regardless of query user_id.
  const userId = authUser.role === "agent" ? authUser.id : q.user_id;
  const result = await callService.listCalls({
    userId,
    leadId: q.lead_id,
    direction: q.direction,
    status: q.status,
    dateFrom: q.date_from ? new Date(q.date_from) : undefined,
    dateTo: q.date_to ? new Date(q.date_to) : undefined,
    page: q.page,
    pageSize: q.pageSize,
  });

  return c.json({ ok: true, data: result });
});

// Call summary: agents always scoped to own user_id (query user_id ignored);
// managers/admins may filter by user_id.
callsRoute.get("/summary", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = summaryQuerySchema.safeParse(c.req.query());

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

  const q = parsed.data;
  const userId = authUser.role === "agent" ? authUser.id : q.user_id;
  const summary = await callService.getSummary({
    userId,
    dateFrom: q.date_from ? new Date(q.date_from) : undefined,
    dateTo: q.date_to ? new Date(q.date_to) : undefined,
  });

  return c.json({ ok: true, data: summary });
});
