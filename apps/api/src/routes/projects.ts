import { Hono } from "hono";
import type { Context } from "hono";
import { canManageProjects, canViewProjects } from "../lib/permissions.js";
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
import { createProjectService } from "../services/projectService.js";

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

  const body = c.req.valid("json");
  const service = createProjectService(c.get("db"));
  const project = await service.createProject(body);

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

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const service = createProjectService(c.get("db"));
    const project = await service.updateProject(id, body);

    return jsonOk(c, project);
  },
);

projectsRoutes.delete("/:id", writeRateLimit, validate("param", uuidParamSchema), async (c) => {
  const denied = requireManage(c);
  if (denied) return denied;

  const { id } = c.req.valid("param");
  const service = createProjectService(c.get("db"));
  const project = await service.softDeleteProject(id);

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
