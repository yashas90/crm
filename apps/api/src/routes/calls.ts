import { Hono } from "hono";
import { z } from "zod";
import { mapCallOutcome } from "../lib/callOutcomes.js";
import type { AuthUser } from "../middleware/auth.js";
import { callsLogRateLimit } from "../middleware/rateLimit.js";
import { callService } from "../services/callService.js";

export const callsRoute = new Hono();

const callOutcomeSchema = z.enum(["answered", "no_answer", "busy", "left_voicemail"]);

const logCallSchema = z
  .object({
    lead_id: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    phone_number: z.string().min(5).optional(),
    phoneNumber: z.string().min(5).optional(),
    direction: z.enum(["incoming", "outgoing"]).optional(),
    status: z.enum(["completed", "missed", "rejected", "failed"]).optional(),
    started_at: z.string().datetime().optional(),
    ended_at: z.string().datetime().optional(),
    duration_seconds: z.number().int().nonnegative().optional(),
    /** Duration in whole minutes (web-friendly). */
    duration: z.number().positive().optional(),
    outcome: callOutcomeSchema,
    disposition: z.string().min(1).optional(),
    notes: z.string().optional(),
    source: z.enum(["mobile-manual", "mobile-auto", "web-manual"]).optional(),
  })
  .superRefine((value, ctx) => {
    const leadId = value.lead_id ?? value.leadId;
    const phone = value.phone_number ?? value.phoneNumber;
    const hasDuration = value.duration_seconds !== undefined || value.duration !== undefined;

    if (!leadId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lead_id is required",
        path: ["lead_id"],
      });
    }
    if (!phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "phone_number is required",
        path: ["phone_number"],
      });
    }
    if (!hasDuration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duration_seconds or duration is required",
        path: ["duration_seconds"],
      });
    }
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
  const leadId = data.lead_id ?? data.leadId;
  const phoneNumber = data.phone_number ?? data.phoneNumber!;
  const durationSeconds = data.duration_seconds ?? Math.round((data.duration ?? 0) * 60);
  const mapped = mapCallOutcome(data.outcome);
  const endedAt = data.ended_at ? new Date(data.ended_at) : new Date();
  const startedAt = data.started_at
    ? new Date(data.started_at)
    : new Date(endedAt.getTime() - durationSeconds * 1000);

  const record = await callService.logCall({
    userId: authUser.id,
    leadId,
    phoneNumber,
    direction: data.direction ?? "outgoing",
    status: data.status ?? mapped.status,
    startedAt,
    endedAt,
    durationSeconds,
    disposition: data.disposition ?? mapped.disposition,
    outcome: data.outcome,
    notes: data.notes,
    source: data.source ?? "web-manual",
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
