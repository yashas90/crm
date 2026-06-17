import { Hono } from "hono";
import type { Context } from "hono";
import { canManageProjects, canViewProjects } from "../lib/permissions.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import {
  createProjectUnitsBodySchema,
  listProjectUnitsQuerySchema,
  projectIdParamSchema,
  projectUnitParamSchema,
  updateProjectUnitSchema,
} from "../lib/validators/projectUnits.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { createBookingDocumentService } from "../services/bookingDocumentService.js";
import { createProjectUnitService } from "../services/projectUnitService.js";

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
  if (!canManageProjects(authUser)) {
    return jsonError(c, "FORBIDDEN", "You cannot manage projects", 403);
  }
  return null;
}

function requireBookingPdfAccess(c: Context) {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role !== "admin" && authUser.role !== "manager") {
    return jsonError(c, "FORBIDDEN", "Booking PDF access is limited to admins and managers", 403);
  }
  return null;
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

    const result = await unitService.updateUnit(projectId, unitId, body);
    const { transitionedToBooked, ...unit } = result;

    let bookingDocument = null;
    if (transitionedToBooked) {
      bookingDocument = await bookingService.generateForBookedUnit({
        projectId,
        unitId,
        actorUserId: authUser.id,
      });
    }

    return jsonOk(c, { ...unit, bookingDocument });
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
    const denied = requireBookingPdfAccess(c);
    if (denied) return denied;

    const { id: projectId, unitId } = c.req.valid("param");
    const bookingService = createBookingDocumentService(c.get("db"));
    const result = await bookingService.getSignedDownloadUrl(projectId, unitId);
    return jsonOk(c, result);
  },
);

/** Validates project id on parent mount — exported for tests. */
export { projectIdParamSchema };
