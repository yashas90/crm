import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { jsonError, jsonOk } from "../lib/response.js";
import { endOfTodayIso } from "../lib/taskNotes.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import { writeRateLimit } from "../middleware/rateLimit.js";
import { NOTIFICATION_TYPES, createNotificationService } from "../services/notificationService.js";
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

const addNoteSchema = z.object({
  text: z.string().min(1).max(2000),
});

const bulkActionSchema = z.object({
  action: z.enum(["complete", "reassign", "delete"]),
  taskIds: z.array(z.string().uuid()).min(1).max(100),
  assignedTo: z.string().uuid().optional(),
});

const listTasksSchema = z.object({
  leadId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  assigneeId: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "open"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function resolveListParams(
  raw: z.infer<typeof listTasksSchema>,
  authUser: AuthUser,
): Parameters<typeof taskService.list>[0] {
  const params: Parameters<typeof taskService.list>[0] = {
    leadId: raw.leadId,
    status: raw.status,
    priority: raw.priority,
    dueAfter: raw.dueAfter,
    page: raw.page,
    pageSize: raw.pageSize,
  };

  const assignee = raw.assigneeId ?? raw.assignedTo;
  if (assignee === "me") {
    params.assignedTo = authUser.id;
  } else if (assignee) {
    params.assignedTo = assignee;
  }

  if (raw.dueBefore === "today") {
    params.dueBefore = endOfTodayIso();
  } else if (raw.dueBefore) {
    params.dueBefore = raw.dueBefore;
  }

  if (authUser.role === "agent") {
    params.assignedTo = authUser.id;
  }

  return params;
}

tasksRoutes.get("/", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const parsed = listTasksSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return jsonError(c, "VALIDATION_ERROR", "Invalid query", 400, parsed.error.flatten());
  }

  const result = await taskService.list(resolveListParams(parsed.data, authUser));
  return jsonOk(c, result);
});

tasksRoutes.post("/bulk", writeRateLimit, validate("json", bulkActionSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");

  if (body.action === "delete" && authUser.role === "agent") {
    return jsonError(c, "FORBIDDEN", "Agents cannot delete tasks", 403);
  }
  if (body.action === "reassign" && authUser.role === "agent") {
    return jsonError(c, "FORBIDDEN", "Agents cannot reassign tasks", 403);
  }
  if (body.action === "reassign" && !body.assignedTo) {
    return jsonError(c, "VALIDATION_ERROR", "assignedTo is required for reassign", 400);
  }

  let result: { succeeded: string[]; failed: string[] };
  if (body.action === "complete") {
    result = await taskService.bulkComplete(body.taskIds);
  } else if (body.action === "reassign") {
    result = await taskService.bulkReassign(body.taskIds, body.assignedTo!);
    if (result.succeeded.length > 0) {
      const notifications = createNotificationService(c.get("db"));
      const reassignedTasks = await taskService.getByIds(result.succeeded);
      await Promise.all(
        reassignedTasks
          .filter((task) => task.assignedTo && task.assignedTo !== authUser.id)
          .map((task) =>
            notifications.createNotification(task.assignedTo!, NOTIFICATION_TYPES.TASK_ASSIGNED, {
              taskId: task.id,
              taskTitle: task.title,
              leadId: task.leadId ?? undefined,
            }),
          ),
      );
    }
  } else {
    result = await taskService.bulkDelete(body.taskIds);
  }

  return jsonOk(c, result);
});

tasksRoutes.post("/", writeRateLimit, validate("json", createTaskSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const body = c.req.valid("json");

  if (body.assignedTo && body.assignedTo !== authUser.id && authUser.role === "agent") {
    return jsonError(c, "FORBIDDEN", "Agents can only assign tasks to themselves", 403);
  }

  const assigneeId = body.assignedTo ?? authUser.id;

  const task = await taskService.create({
    ...body,
    createdBy: authUser.id,
    assignedTo: assigneeId,
  });

  if (assigneeId !== authUser.id) {
    const notifications = createNotificationService(c.get("db"));
    await notifications.createNotification(assigneeId, NOTIFICATION_TYPES.TASK_ASSIGNED, {
      taskId: task.id,
      taskTitle: task.title,
      leadId: task.leadId ?? undefined,
    });
  }

  return jsonOk(c, task, undefined, 201);
});

tasksRoutes.get("/:id", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id")!;
  const task = await taskService.getById(id);
  if (!task) return jsonError(c, "NOT_FOUND", "Task not found", 404);
  if (authUser.role === "agent" && task.assignedTo !== authUser.id) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  return jsonOk(c, task);
});

tasksRoutes.patch("/:id", writeRateLimit, validate("json", updateTaskSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id")!;
  const body = c.req.valid("json");

  const existing = await taskService.getById(id);
  if (!existing) return jsonError(c, "NOT_FOUND", "Task not found", 404);
  if (authUser.role === "agent" && existing.assignedTo !== authUser.id) {
    return jsonError(c, "FORBIDDEN", "Access denied", 403);
  }
  if (body.assignedTo && body.assignedTo !== authUser.id && authUser.role === "agent") {
    return jsonError(c, "FORBIDDEN", "Agents can only assign tasks to themselves", 403);
  }

  const task = await taskService.update(id, body);
  if (!task) return jsonError(c, "NOT_FOUND", "Task not found", 404);

  const newAssignee = body.assignedTo ?? undefined;
  if (newAssignee && newAssignee !== existing.assignedTo && newAssignee !== authUser.id) {
    const notifications = createNotificationService(c.get("db"));
    await notifications.createNotification(newAssignee, NOTIFICATION_TYPES.TASK_ASSIGNED, {
      taskId: task.id,
      taskTitle: task.title,
      leadId: task.leadId ?? undefined,
    });
  }

  const full = await taskService.getById(id);
  return jsonOk(c, full);
});

tasksRoutes.post("/:id/notes", writeRateLimit, validate("json", addNoteSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id")!;
  const body = c.req.valid("json");

  const result = await taskService.addNote(id, {
    text: body.text,
    authorId: authUser.id,
    authorName: authUser.name ?? authUser.email ?? "User",
  });
  if (!result) return jsonError(c, "NOT_FOUND", "Task not found", 404);
  return jsonOk(c, result, undefined, 201);
});

async function handleComplete(c: Context) {
  const id = c.req.param("id")!;
  const task = await taskService.complete(id);
  if (!task) return jsonError(c, "NOT_FOUND", "Task not found", 404);
  const full = await taskService.getById(id);
  return jsonOk(c, full);
}

tasksRoutes.post("/:id/complete", writeRateLimit, handleComplete);
tasksRoutes.patch("/:id/complete", writeRateLimit, handleComplete);

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
