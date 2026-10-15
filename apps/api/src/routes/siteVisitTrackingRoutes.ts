import {
  type VisitOutcome,
  checkInTooEarlyMessage,
  validateVisitSlot,
} from "@propninja/types/site-visit-tracking";
import type { Hono } from "hono";
import { z } from "zod";
import { jsonError, jsonOk } from "../lib/response.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { siteVisitService } from "../services/siteVisitService.js";
import {
  CheckInTooEarlyError,
  OutsideZoneError,
  siteVisitTrackingService,
} from "../services/siteVisitTrackingService.js";

const visitStatuses = [
  "scheduled",
  "reminder_sent",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
] as const;

const outcomes = [
  "deal_closed",
  "very_interested",
  "negotiating",
  "interested",
  "needs_time",
  "wants_different_property",
  "not_interested",
  "revisit_required",
] as const;

async function canMutate(user: AuthUser, agentId: string) {
  if (user.role === "admin") return true;
  if (user.role === "agent") return user.id === agentId;
  return siteVisitTrackingService.managerCanAccess(user.id, agentId);
}

export function registerSiteVisitTrackingRoutes(router: Hono) {
  router.get("/manager-board", async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    if (authUser.role === "agent") {
      return jsonError(c, "FORBIDDEN", "Managers and admins can view the visit board", 403);
    }
    const data = await siteVisitTrackingService.managerBoard(authUser);
    return jsonOk(c, data);
  });

  router.get("/reports/me", async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const data = await siteVisitTrackingService.agentReport(authUser.id);
    return jsonOk(c, data);
  });

  router.get("/reports/org", async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    if (authUser.role !== "admin") {
      return jsonError(c, "FORBIDDEN", "Only admins can view the org visit report", 403);
    }
    const data = await siteVisitTrackingService.adminReport();
    return jsonOk(c, data);
  });

  router.get("/reports/org.xlsx", async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    if (authUser.role !== "admin") {
      return jsonError(c, "FORBIDDEN", "Only admins can export the visit report", 403);
    }
    const report = await siteVisitTrackingService.adminReport();
    const body = siteVisitTrackingService.adminWorkbook(report);
    return c.body(body, 200, {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": 'attachment; filename="site-visit-report.xls"',
    });
  });

  router.post("/:id/check-in", writeRateLimit, async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const visitId = c.req.param("id");
    if (!visitId) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    const visit = await siteVisitService.getById(visitId);
    if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    if (!(await canMutate(authUser, visit.agentId))) {
      return jsonError(c, "FORBIDDEN", "Agents can only check in their own visits", 403);
    }
    const early = checkInTooEarlyMessage(
      visit.visitDate,
      visit.visitTime,
      new Date(),
      visit.scheduledAt,
    );
    if (early) return jsonError(c, "CHECKIN_TOO_EARLY", early, 400);

    const body = z
      .object({
        lat: z.number().finite().optional(),
        lng: z.number().finite().optional(),
        confirmOutside: z.boolean().optional(),
      })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return jsonError(c, "VALIDATION_ERROR", "Invalid check-in", 400);

    try {
      const result = await siteVisitTrackingService.checkIn(visit.id, body.data);
      return jsonOk(c, result);
    } catch (error) {
      if (error instanceof CheckInTooEarlyError) {
        return jsonError(c, "CHECKIN_TOO_EARLY", error.message, 400);
      }
      if (error instanceof OutsideZoneError) {
        return jsonError(c, "OUTSIDE_ZONE", error.message, 409, {
          distanceMeters: error.distanceMeters,
          radiusMeters: error.radiusMeters,
        });
      }
      throw error;
    }
  });

  router.post("/:id/arrival", writeRateLimit, async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const visitId = c.req.param("id");
    if (!visitId) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    const visit = await siteVisitService.getById(visitId);
    if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    if (!(await canMutate(authUser, visit.agentId))) {
      return jsonError(c, "FORBIDDEN", "Not allowed to update this visit", 403);
    }
    const body = z
      .object({
        customerPresent: z.enum(["present", "running_late", "no_show"]),
        companionCount: z.number().int().min(0).max(20).optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return jsonError(c, "VALIDATION_ERROR", "Invalid arrival", 400);
    const result = await siteVisitTrackingService.recordArrival(visit.id, body.data);
    return jsonOk(c, result);
  });

  router.post("/:id/feedback", writeRateLimit, async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const visitId = c.req.param("id");
    if (!visitId) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    const visit = await siteVisitService.getById(visitId);
    if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    if (!(await canMutate(authUser, visit.agentId))) {
      return jsonError(c, "FORBIDDEN", "Not allowed to update this visit", 403);
    }
    const body = z
      .object({
        answers: z
          .array(
            z.object({
              question: z.string().min(1).max(500),
              answer: z.string().max(4000),
              answerType: z.enum(["stars", "multi", "single", "text", "datetime"]),
            }),
          )
          .min(1)
          .max(30),
        notes: z.string().max(4000).nullable().optional(),
        photos: z.array(z.string().max(2000)).max(12).optional(),
        signature: z.string().max(500_000).nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return jsonError(c, "VALIDATION_ERROR", "Invalid feedback", 400);
    const result = await siteVisitTrackingService.saveFeedback(visit.id, body.data);
    return jsonOk(c, result);
  });

  router.post("/:id/checkout", writeRateLimit, async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const visitId = c.req.param("id");
    if (!visitId) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    const visit = await siteVisitService.getById(visitId);
    if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    if (!(await canMutate(authUser, visit.agentId))) {
      return jsonError(c, "FORBIDDEN", "Not allowed to update this visit", 403);
    }
    const body = z
      .object({
        outcome: z.enum(outcomes),
        nextAction: z
          .enum([
            "follow_up_call",
            "second_visit",
            "payment_plan",
            "negotiation",
            "booking",
            "drop_lead",
          ])
          .nullable()
          .optional(),
        nextActionDate: z.string().datetime().nullable().optional(),
        reason: z.string().max(1000).nullable().optional(),
        preferenceNote: z.string().max(1000).nullable().optional(),
        signature: z.string().max(500_000).nullable().optional(),
      })
      .safeParse(await c.req.json());
    if (!body.success) return jsonError(c, "VALIDATION_ERROR", "Invalid checkout", 400);
    const result = await siteVisitTrackingService.checkout(visit.id, authUser.id, {
      ...body.data,
      outcome: body.data.outcome as VisitOutcome,
    });
    return jsonOk(c, result);
  });

  router.get("/:id/summary.pdf", async (c) => {
    const authUser = c.get("authUser") as AuthUser;
    const visitId = c.req.param("id");
    if (!visitId) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    const visit = await siteVisitService.getById(visitId);
    if (!visit) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    if (authUser.role === "agent" && visit.agentId !== authUser.id) {
      return jsonError(c, "FORBIDDEN", "Not allowed to view this visit", 403);
    }
    if (authUser.role === "manager" && !(await canMutate(authUser, visit.agentId))) {
      return jsonError(c, "FORBIDDEN", "Not allowed to view this visit", 403);
    }
    const pdf = await siteVisitTrackingService.summaryPdf(visit.id);
    if (!pdf) return jsonError(c, "NOT_FOUND", "Site visit not found", 404);
    return c.body(new Uint8Array(pdf), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="site-visit-${visit.id}.pdf"`,
    });
  });
}

export const trackingVisitStatuses = visitStatuses;
export const slotError = validateVisitSlot;
