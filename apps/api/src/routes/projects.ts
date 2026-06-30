import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import {
  GalleryFileValidationError,
  MAX_GALLERY_IMAGE_BYTES,
  galleryItemId,
  uploadGalleryImage,
} from "../lib/galleryFiles.js";
import { parseDocumentMultipart } from "../lib/multipartUpload.js";
import { canManageProjects, canViewProjects } from "../lib/permissions.js";
import { isR2Configured } from "../lib/r2Storage.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import { uuidParamSchema } from "../lib/validators/common.js";
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectScopeCountsQuerySchema,
  toggleProjectAvailabilitySchema,
  updateProjectSchema,
} from "../lib/validators/projects.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { logAudit } from "../services/auditService.js";
import { createProjectService } from "../services/projectService.js";
import { projectUnitsRoutes } from "./projectUnits.js";

export const projectsRoutes = new Hono();

function requireView(c: Context) {
  const authUser = c.get("authUser");
  if (!canViewProjects(authUser)) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return null;
}

function requireManage(c: Context) {
  const authUser = c.get("authUser");
  if (!canManageProjects(authUser)) {
    return jsonError(c, "FORBIDDEN", "You cannot manage projects", 403);
  }
  return null;
}

projectsRoutes.get("/scope-counts", async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const parsed = projectScopeCountsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid query", 400, parsed.error.flatten());
  }

  const service = createProjectService(c.get("db"));
  const data = await service.getScopeCounts(parsed.data);

  return c.json({ ok: true, data });
});

projectsRoutes.get("/", validate("query", listProjectsQuerySchema), async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const query = c.req.valid("query");
  const service = createProjectService(c.get("db"));
  const data = await service.listProjects(query);

  return c.json({ ok: true, data });
});

projectsRoutes.post("/", writeRateLimit, validate("json", createProjectSchema), async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const authUser = c.get("authUser");
  const body = c.req.valid("json");
  const db = c.get("db");
  const service = createProjectService(db);
  const project = await service.createProject(body);

  await logAudit(db, {
    userId: authUser.id,
    action: "PROJECT_CREATED",
    entityType: "project",
    entityId: project.id,
    metadata: { name: project.name },
  });

  return jsonOk(c, project, undefined, 201);
});

projectsRoutes.get("/:id", validate("param", uuidParamSchema), async (c) => {
  const denied = requireView(c);
  if (denied) return denied;

  const { id } = c.req.valid("param");
  const service = createProjectService(c.get("db"));
  const project = await service.getProjectById(id);

  return jsonOk(c, project);
});

projectsRoutes.patch(
  "/:id",
  writeRateLimit,
  validate("param", uuidParamSchema),
  validate("json", updateProjectSchema),
  async (c) => {
    const denied = requireManage(c);
    if (denied) return denied;

    const authUser = c.get("authUser");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");
    const service = createProjectService(db);
    const project = await service.updateProject(id, body);

    await logAudit(db, {
      userId: authUser.id,
      action: "PROJECT_UPDATED",
      entityType: "project",
      entityId: id,
      metadata: { name: project.name, fields: Object.keys(body) },
    });

    return jsonOk(c, project);
  },
);

projectsRoutes.delete("/:id", writeRateLimit, validate("param", uuidParamSchema), async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const authUser = c.get("authUser");
  const { id } = c.req.valid("param");
  const db = c.get("db");
  const service = createProjectService(db);
  const project = await service.softDeleteProject(id);

  await logAudit(db, {
    userId: authUser.id,
    action: "PROJECT_DELETED",
    entityType: "project",
    entityId: id,
    metadata: { name: project.name },
  });

  return jsonOk(c, project);
});

projectsRoutes.post(
  "/:id/toggle-availability",
  writeRateLimit,
  validate("param", uuidParamSchema),
  validate("json", toggleProjectAvailabilitySchema),
  async (c) => {
    const denied = requireManage(c);
    if (denied) return denied;

    const { id } = c.req.valid("param");
    const { availability } = c.req.valid("json");
    const service = createProjectService(c.get("db"));
    const project = await service.toggleAvailability(id, availability);

    return jsonOk(c, project);
  },
);

projectsRoutes.route("/:id/units", projectUnitsRoutes);

projectsRoutes.post(
  "/:id/gallery/upload",
  writeRateLimit,
  validate("param", uuidParamSchema),
  async (c) => {
    const denied = requireManage(c);
    if (denied) return denied;

    if (!isR2Configured()) {
      return jsonError(c, "STORAGE_NOT_CONFIGURED", "Image storage is not configured", 503);
    }

    const { id: projectId } = c.req.valid("param");
    const db = c.get("db");
    const service = createProjectService(db);

    try {
      const project = await service.getProjectById(projectId);
      const { file } = await parseDocumentMultipart(c.req.raw, MAX_GALLERY_IMAGE_BYTES);
      const uploaded = await uploadGalleryImage(projectId, file.filename, file.buffer);

      const existingItems = project.gallery?.items ?? [];
      const item = {
        id: galleryItemId(uploaded.fileKey),
        name: uploaded.name,
        url: uploaded.url,
        fileKey: uploaded.fileKey,
        mimeType: uploaded.mimeType,
      };

      const updated = await service.updateProject(projectId, {
        gallery: { items: [...existingItems, item] },
      });

      return jsonOk(c, { item, gallery: updated.gallery }, undefined, 201);
    } catch (error) {
      if (error instanceof GalleryFileValidationError) {
        return jsonError(c, error.code, error.message, 400);
      }
      throw error;
    }
  },
);

projectsRoutes.delete(
  "/:id/gallery/:itemId",
  writeRateLimit,
  validate(
    "param",
    z.object({
      id: z.string().uuid(),
      itemId: z.string().min(1),
    }),
  ),
  async (c) => {
    const denied = requireManage(c);
    if (denied) return denied;

    const { id: projectId, itemId } = c.req.valid("param");
    const service = createProjectService(c.get("db"));
    const project = await service.getProjectById(projectId);
    const items = project.gallery?.items ?? [];
    const nextItems = items.filter((item) => item.id !== itemId);

    if (nextItems.length === items.length) {
      return jsonError(c, "NOT_FOUND", "Gallery item not found", 404);
    }

    const updated = await service.updateProject(projectId, {
      gallery: { items: nextItems },
    });

    return jsonOk(c, { gallery: updated.gallery });
  },
);
