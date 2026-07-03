import { Hono } from "hono";
import type { Context } from "hono";
import { canManageUnitInventory, canViewProjects } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import {
  bookUnitSchema,
  createProjectUnitsBodySchema,
  listProjectUnitsQuerySchema,
  projectIdParamSchema,
  projectUnitParamSchema,
  reserveUnitSchema,
  updateProjectUnitSchema,
} from "../lib/validators/projectUnits.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { createBookingDocumentService } from "../services/bookingDocumentService.js";
import { createProjectUnitService } from "../services/projectUnitService.js";
import {
  assertCanAssignLeadToUnit,
  assertCanModifyUnitBooking,
  requireBookingPdfAccess,
  requireUnitBookingTransition,
} from "./bookings.js";

export const projectUnitsRoutes = new Hono();

function requireView(c: Context) {
  const authUser = c.get("authUser") as AuthUser;
  if (!canViewProjects(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

function requireManage(c: Context) {
  const authUser = c.get("authUser") as AuthUser;
  if (!canManageUnitInventory(authUser)) {
    return jsonError(c, "FORBIDDEN", "You cannot manage project inventory", 403);
  }
  return null;
}

async function applyBookedTransition(
  c: Context,
  projectId: string,
  unitId: string,
  body: { priceFinalRs?: number },
) {
  const authUser = c.get("authUser") as AuthUser;
  const db = c.get("db");
  const unitService = createProjectUnitService(db);
  const bookingService = createBookingDocumentService(db);

  const payload: { status: "booked"; priceFinalRs?: number } = { status: "booked" };
  if (body.priceFinalRs !== undefined) {
    payload.priceFinalRs = body.priceFinalRs;
  }

  const result = await unitService.updateUnit(projectId, unitId, payload, {
    actorUserId: authUser.id,
  });
  const { transitionedToBooked, ...unit } = result;

  let bookingDocument = null;
  if (transitionedToBooked) {
    bookingDocument = await bookingService.generateForBookedUnit({
      projectId,
      unitId,
      actorUserId: authUser.id,
    });
  } else {
    bookingDocument = await bookingService.getLatestForUnit(unitId);
  }

  return jsonOk(c, {
    ...unit,
    bookingDocument: bookingDocument
      ? {
          id: bookingDocument.id,
          bookingRef: bookingDocument.bookingRef,
          fileKey: bookingDocument.fileKey,
          fileUrl: bookingDocument.fileUrl,
          generatedAt: bookingDocument.generatedAt.toISOString(),
        }
      : null,
  });
}

projectUnitsRoutes.get("/", validate("query", listProjectUnitsQuerySchema), async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const { id: projectId } = c.req.param() as { id: string };
  const query = c.req.valid("query");
  const service = createProjectUnitService(c.get("db"));
  const units = await service.listUnits(projectId, query);
  return jsonOk(c, units);
});

projectUnitsRoutes.get("/summary", async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const { id: projectId } = c.req.param() as { id: string };
  const service = createProjectUnitService(c.get("db"));
  const summary = await service.getUnitSummary(projectId);
  return jsonOk(c, summary);
});

projectUnitsRoutes.get("/export", async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const { id: projectId } = c.req.param() as { id: string };
  const service = createProjectUnitService(c.get("db"));
  const csv = await service.exportCsv(projectId);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="project-${projectId}-units.csv"`,
    },
  });
});

projectUnitsRoutes.post(
  "/",
  writeRateLimit,
  validate("json", createProjectUnitsBodySchema),
  async (c) => {
    const denied = requireManage(c);
    if (denied) return denied;

    const { id: projectId } = c.req.param() as { id: string };
    const body = c.req.valid("json");
    const service = createProjectUnitService(c.get("db"));
    const units = await service.createUnits(projectId, body);
    return jsonOk(c, units, undefined, 201);
  },
);

projectUnitsRoutes.post(
  "/:unitId/reserve",
  writeRateLimit,
  validate("param", projectUnitParamSchema),
  validate("json", reserveUnitSchema),
  async (c) => {
    const denied = requireUnitBookingTransition(c);
    if (denied) return denied;

    const { id: projectId, unitId } = c.req.valid("param");
    const { leadId } = c.req.valid("json");

    const assignDenied = await assertCanAssignLeadToUnit(c, leadId);
    if (assignDenied) return assignDenied;

    const unitDenied = await assertCanModifyUnitBooking(c, projectId, unitId);
    if (unitDenied) return unitDenied;

    const unitService = createProjectUnitService(c.get("db"));
    const result = await unitService.updateUnit(projectId, unitId, {
      status: "reserved",
      assignedLeadId: leadId,
    });
    const { transitionedToBooked: _ignored, ...unit } = result;
    return jsonOk(c, unit);
  },
);

projectUnitsRoutes.post(
  "/:unitId/book",
  writeRateLimit,
  validate("param", projectUnitParamSchema),
  validate("json", bookUnitSchema),
  async (c) => {
    const denied = requireUnitBookingTransition(c);
    if (denied) return denied;

    const { id: projectId, unitId } = c.req.valid("param");
    const body = c.req.valid("json");

    const unitDenied = await assertCanModifyUnitBooking(c, projectId, unitId);
    if (unitDenied) return unitDenied;

    return applyBookedTransition(c, projectId, unitId, body);
  },
);

projectUnitsRoutes.post(
  "/:unitId/release",
  writeRateLimit,
  validate("param", projectUnitParamSchema),
  async (c) => {
    const denied = requireUnitBookingTransition(c);
    if (denied) return denied;

    const { id: projectId, unitId } = c.req.valid("param");

    const unitDenied = await assertCanModifyUnitBooking(c, projectId, unitId);
    if (unitDenied) return unitDenied;

    const unitService = createProjectUnitService(c.get("db"));
    const result = await unitService.updateUnit(projectId, unitId, { status: "available" });
    const { transitionedToBooked: _ignored, ...unit } = result;
    return jsonOk(c, unit);
  },
);

projectUnitsRoutes.patch(
  "/:unitId",
  writeRateLimit,
  validate("param", projectUnitParamSchema),
  validate("json", updateProjectUnitSchema),
  async (c) => {
    const denied = requireManage(c);
    if (denied) return denied;

    const authUser = c.get("authUser") as AuthUser;
    const { id: projectId, unitId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");
    const unitService = createProjectUnitService(db);
    const bookingService = createBookingDocumentService(db);

    const result = await unitService.updateUnit(projectId, unitId, body, {
      actorUserId: authUser.id,
    });
    const { transitionedToBooked, ...unit } = result;

    let bookingDocument = null;
    if (transitionedToBooked) {
      bookingDocument = await bookingService.generateForBookedUnit({
        projectId,
        unitId,
        actorUserId: authUser.id,
      });
    }

    return jsonOk(c, {
      ...unit,
      bookingDocument: bookingDocument
        ? {
            id: bookingDocument.id,
            bookingRef: bookingDocument.bookingRef,
            fileKey: bookingDocument.fileKey,
            fileUrl: bookingDocument.fileUrl,
            generatedAt: bookingDocument.generatedAt.toISOString(),
          }
        : null,
    });
  },
);

projectUnitsRoutes.delete(
  "/:unitId",
  writeRateLimit,
  validate("param", projectUnitParamSchema),
  async (c) => {
    const denied = requireManage(c);
    if (denied) return denied;

    const { id: projectId, unitId } = c.req.valid("param");
    const service = createProjectUnitService(c.get("db"));
    await service.deleteUnit(projectId, unitId);
    return jsonOk(c, { deleted: true });
  },
);

projectUnitsRoutes.get(
  "/:unitId/booking-pdf",
  validate("param", projectUnitParamSchema),
  async (c) => {
    const { id: projectId, unitId } = c.req.valid("param");
    const denied = await requireBookingPdfAccess(c, projectId, unitId);
    if (denied) return denied;

    const bookingService = createBookingDocumentService(c.get("db"));
    const result = await bookingService.getSignedDownloadUrl(projectId, unitId);
    return jsonOk(c, result);
  },
);

/** Validates project id on parent mount — exported for tests. */
export { projectIdParamSchema };
