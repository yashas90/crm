import { Hono } from "hono";
import { z } from "zod";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { taskService } from "../services/taskService.js";

export const tasksRoutes = new Hono();

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  taskType: z.enum(["call", "meeting", "follow_up", "document", "site_visit", "other"]).optional(),
  leadId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  taskType: z.enum(["call", "meeting", "follow_up", "document", "site_visit", "other"]).optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

const listTasksSchema = z.object({
  leadId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

tasksRoutes.get("/", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = listTasksSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid query", 400, parsed.error.flatten());
  }

  const params = parsed.data;
  // Agents only see their own tasks
  if (authUser.role === "agent") {
    params.assignedTo = authUser.id;
  }

  const result = await taskService.list(params);
  return jsonOk(c, result);
});

tasksRoutes.post("/", writeRateLimit, validate("json", createTaskSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");

  const task = await taskService.create({
    ...body,
    createdBy: authUser.id,
    assignedTo: body.assignedTo ?? authUser.id,
  });
  return jsonOk(c, task, undefined, 201);
});

tasksRoutes.get("/:id", async (c) => {
  const id = c.req.param("id")!;
  const task = await taskService.getById(id);
  if (!task) return jsonError(c, "NOT_FOUND", "Task not found", 404);
  return jsonOk(c, task);
});

tasksRoutes.patch("/:id", writeRateLimit, validate("json", updateTaskSchema), async (c) => {
  const id = c.req.param("id")!;
  const body = c.req.valid("json");
  const task = await taskService.update(id, body);
  if (!task) return jsonError(c, "NOT_FOUND", "Task not found", 404);
  return jsonOk(c, task);
});

tasksRoutes.post("/:id/complete", writeRateLimit, async (c) => {
  const id = c.req.param("id")!;
  const task = await taskService.complete(id);
  if (!task) return jsonError(c, "NOT_FOUND", "Task not found", 404);
  return jsonOk(c, task);
});

tasksRoutes.delete("/:id", writeRateLimit, async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  if (authUser.role === "agent") {
    return jsonError(c, "FORBIDDEN", "Agents cannot delete tasks", 403);
  }
  const id = c.req.param("id")!;
  const task = await taskService.delete(id);
  if (!task) return jsonError(c, "NOT_FOUND", "Task not found", 404);
  return jsonOk(c, { deleted: true });
});
