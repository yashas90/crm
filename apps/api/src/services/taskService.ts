import { leads, tasks, users } from "@propninja/db";
import { and, asc, count, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskType = "call" | "meeting" | "follow_up" | "document" | "site_visit" | "other";

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueAt?: string;
  priority?: TaskPriority;
  taskType?: TaskType;
  leadId?: string;
  assignedTo?: string;
  createdBy: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: TaskPriority;
  taskType?: TaskType;
  status?: TaskStatus;
  assignedTo?: string | null;
}

export interface ListTasksParams {
  leadId?: string;
  assignedTo?: string;
  status?: TaskStatus;
  dueBefore?: string;
  dueAfter?: string;
  page?: number;
  pageSize?: number;
}

export const taskService = {
  async create(input: CreateTaskInput) {
    const [row] = await db
      .insert(tasks)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        title: input.title,
        description: input.description,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        priority: input.priority ?? "medium",
        taskType: input.taskType ?? "follow_up",
        leadId: input.leadId,
        assignedTo: input.assignedTo,
        createdBy: input.createdBy,
      })
      .returning();
    return row!;
  },

  async getById(id: string) {
    const [row] = await db
      .select({
        id: tasks.id,
        orgId: tasks.orgId,
        leadId: tasks.leadId,
        assignedTo: tasks.assignedTo,
        createdBy: tasks.createdBy,
        title: tasks.title,
        description: tasks.description,
        dueAt: tasks.dueAt,
        priority: tasks.priority,
        status: tasks.status,
        taskType: tasks.taskType,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assigneeUser: {
          id: users.id,
          name: users.name,
        },
        lead: {
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
        },
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .leftJoin(leads, eq(tasks.leadId, leads.id))
      .where(and(eq(tasks.id, id), eq(tasks.orgId, SINGLE_TENANT_ORG_ID)))
      .limit(1);
    return row ?? null;
  },

  async list(params: ListTasksParams = {}) {
    const { page = 1, pageSize = 50 } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(tasks.orgId, SINGLE_TENANT_ORG_ID)];

    if (params.leadId) conditions.push(eq(tasks.leadId, params.leadId));
    if (params.assignedTo) conditions.push(eq(tasks.assignedTo, params.assignedTo));
    if (params.status) conditions.push(eq(tasks.status, params.status));
    if (params.dueBefore) conditions.push(lte(tasks.dueAt, new Date(params.dueBefore)));
    if (params.dueAfter) conditions.push(gte(tasks.dueAt, new Date(params.dueAfter)));

    const where = and(...conditions);

    const [{ total }] = await db.select({ total: count() }).from(tasks).where(where);

    const items = await db
      .select({
        id: tasks.id,
        leadId: tasks.leadId,
        assignedTo: tasks.assignedTo,
        createdBy: tasks.createdBy,
        title: tasks.title,
        description: tasks.description,
        dueAt: tasks.dueAt,
        priority: tasks.priority,
        status: tasks.status,
        taskType: tasks.taskType,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assigneeUser: {
          id: users.id,
          name: users.name,
        },
        lead: {
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
        },
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .leftJoin(leads, eq(tasks.leadId, leads.id))
      .where(where)
      .orderBy(
        sql`CASE WHEN ${tasks.status} = 'pending' OR ${tasks.status} = 'in_progress' THEN 0 ELSE 1 END`,
        asc(tasks.dueAt),
        desc(tasks.createdAt),
      )
      .limit(pageSize)
      .offset(offset);

    return { items, total: total ?? 0, page, pageSize };
  },

  async update(id: string, input: UpdateTaskInput) {
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updateValues.title = input.title;
    if (input.description !== undefined) updateValues.description = input.description;
    if ("dueAt" in input) updateValues.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (input.priority !== undefined) updateValues.priority = input.priority;
    if (input.taskType !== undefined) updateValues.taskType = input.taskType;
    if (input.status !== undefined) {
      updateValues.status = input.status;
      if (input.status === "completed") {
        updateValues.completedAt = new Date();
      } else {
        updateValues.completedAt = null;
      }
    }
    if ("assignedTo" in input) updateValues.assignedTo = input.assignedTo ?? null;

    const [row] = await db
      .update(tasks)
      .set(updateValues as Partial<typeof tasks.$inferInsert>)
      .where(and(eq(tasks.id, id), eq(tasks.orgId, SINGLE_TENANT_ORG_ID)))
      .returning();
    return row ?? null;
  },

  async complete(id: string) {
    const [row] = await db
      .update(tasks)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.orgId, SINGLE_TENANT_ORG_ID)))
      .returning();
    return row ?? null;
  },

  async delete(id: string) {
    const [row] = await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.orgId, SINGLE_TENANT_ORG_ID)))
      .returning();
    return row ?? null;
  },

  async getOverdueCounts(assignedTo?: string) {
    const now = new Date();
    const conditions = [
      eq(tasks.orgId, SINGLE_TENANT_ORG_ID),
      or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress"))!,
      lte(tasks.dueAt, now),
    ];
    if (assignedTo) conditions.push(eq(tasks.assignedTo, assignedTo));

    const [{ total }] = await db
      .select({ total: count() })
      .from(tasks)
      .where(and(...conditions));
    return total ?? 0;
  },
};
