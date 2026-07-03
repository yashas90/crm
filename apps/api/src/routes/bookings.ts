import { leads } from "@propninja/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  canManageProjects,
  canTransitionUnitBooking,
  canViewBookingPdf,
  canViewProjects,
} from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { listBookingsQuerySchema } from "../lib/validators/bookings.js";
import type { AuthUser } from "../middleware/auth.js";
import { createBookingDocumentService } from "../services/bookingDocumentService.js";

export const bookingsRoutes = new Hono();

function requireView(c: Context) {
  const authUser = c.get("authUser") as AuthUser;
  if (!canViewProjects(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

bookingsRoutes.get("/", validate("query", listBookingsQuerySchema), async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const authUser = c.get("authUser") as AuthUser;
  const query = c.req.valid("query");
  const bookingService = createBookingDocumentService(c.get("db"));

  const scope =
    authUser.role === "agent"
      ? { agentId: authUser.id }
      : query.agentId
        ? { agentId: query.agentId }
        : undefined;

  const data = await bookingService.listBookings(query, scope);
  return jsonOk(c, data);
});

/** Validates agent can assign the given lead to a unit. */
export async function assertCanAssignLeadToUnit(
  c: Context,
  leadId: string,
): Promise<Response | null> {
  const authUser = c.get("authUser") as AuthUser;
  if (canManageProjects(authUser)) return null;

  const db = c.get("db");
  const [lead] = await db
    .select({ assignedTo: leads.assignedTo })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) {
    return jsonError(c, "NOT_FOUND", "Lead not found", 404);
  }

  if (lead.assignedTo !== authUser.id) {
    return jsonError(c, "FORBIDDEN", "You can only book units for leads assigned to you", 403);
  }

  return null;
}

/** Validates agent can modify an existing unit assignment. */
export async function assertCanModifyUnitBooking(
  c: Context,
  projectId: string,
  unitId: string,
): Promise<Response | null> {
  const authUser = c.get("authUser") as AuthUser;
  if (canManageProjects(authUser)) return null;

  const { createProjectUnitService } = await import("../services/projectUnitService.js");
  const unitService = createProjectUnitService(c.get("db"));
  const row = await unitService.getUnitWithLeadAccess(projectId, unitId);

  if (!row) {
    return jsonError(c, "NOT_FOUND", "Unit not found", 404);
  }

  if (row.leadAssignedTo && row.leadAssignedTo !== authUser.id) {
    return jsonError(c, "FORBIDDEN", "This unit is linked to another agent's lead", 403);
  }

  return null;
}

export function requireUnitBookingTransition(c: Context) {
  const authUser = c.get("authUser") as AuthUser;
  if (!canTransitionUnitBooking(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

export async function requireBookingPdfAccess(c: Context, projectId: string, unitId: string) {
  const authUser = c.get("authUser") as AuthUser;
  const bookingService = createBookingDocumentService(c.get("db"));
  const context = await bookingService.getBookingPdfAccessContext(projectId, unitId);

  if (!canViewBookingPdf(authUser, context)) {
    return jsonError(c, "FORBIDDEN", "Booking PDF access denied", 403);
  }

  return null;
}
