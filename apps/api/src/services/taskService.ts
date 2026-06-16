import { leads, tasks, users } from "@propninja/db";
import { and, asc, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import {
  type TaskNoteEntry,
  appendTaskNote,
  endOfTodayIso,
  parseTaskNotes,
  startOfTodayIso,
} from "../lib/taskNotes.js";

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
  status?: TaskStatus | "open";
  priority?: TaskPriority;
  dueBefore?: string;
  dueAfter?: string;
  page?: number;
  pageSize?: number;
}

const taskSelectFields = {
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
  notes: tasks.notes,
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
};

function mapTaskRow<T extends { notes: string | null }>(row: T) {
  return {
    ...row,
    noteEntries: parseTaskNotes(row.notes),
  };
}

function buildListConditions(params: ListTasksParams) {
  const conditions = [eq(tasks.orgId, SINGLE_TENANT_ORG_ID)];

  if (params.leadId) conditions.push(eq(tasks.leadId, params.leadId));
  if (params.assignedTo) conditions.push(eq(tasks.assignedTo, params.assignedTo));
  if (params.priority) conditions.push(eq(tasks.priority, params.priority));
  if (params.status === "open") {
    conditions.push(or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress"))!);
  } else if (params.status) {
    conditions.push(eq(tasks.status, params.status));
  }
  if (params.dueBefore) conditions.push(lte(tasks.dueAt, new Date(params.dueBefore)));
  if (params.dueAfter) conditions.push(gte(tasks.dueAt, new Date(params.dueAfter)));

  return and(...conditions);
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
      .select(taskSelectFields)
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .leftJoin(leads, eq(tasks.leadId, leads.id))
      .where(and(eq(tasks.id, id), eq(tasks.orgId, SINGLE_TENANT_ORG_ID)))
      .limit(1);
    return row ? mapTaskRow(row) : null;
  },

  async list(params: ListTasksParams = {}) {
    const { page = 1, pageSize = 50 } = params;
    const offset = (page - 1) * pageSize;
    const where = buildListConditions(params);

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
        notes: tasks.notes,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        assigneeUser: taskSelectFields.assigneeUser,
        lead: taskSelectFields.lead,
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

    return {
      items: items.map(mapTaskRow),
      total: total ?? 0,
      page,
      pageSize,
    };
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

  async addNote(
    id: string,
    input: { text: string; authorId: string; authorName: string },
  ): Promise<{ noteEntries: TaskNoteEntry[] } | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const notes = appendTaskNote(existing.notes, input);
    const [row] = await db
      .update(tasks)
      .set({ notes, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.orgId, SINGLE_TENANT_ORG_ID)))
      .returning({ notes: tasks.notes });

    if (!row) return null;
    return { noteEntries: parseTaskNotes(row.notes) };
  },

  async bulkComplete(taskIds: string[]) {
    if (taskIds.length === 0) return { succeeded: [] as string[], failed: [] as string[] };
    const now = new Date();
    const rows = await db
      .update(tasks)
      .set({ status: "completed", completedAt: now, updatedAt: now })
      .where(and(eq(tasks.orgId, SINGLE_TENANT_ORG_ID), inArray(tasks.id, taskIds)))
      .returning({ id: tasks.id });
    const succeeded = rows.map((r) => r.id);
    const failed = taskIds.filter((id) => !succeeded.includes(id));
    return { succeeded, failed };
  },

  async bulkReassign(taskIds: string[], assignedTo: string) {
    if (taskIds.length === 0) return { succeeded: [] as string[], failed: [] as string[] };
    const rows = await db
      .update(tasks)
      .set({ assignedTo, updatedAt: new Date() })
      .where(and(eq(tasks.orgId, SINGLE_TENANT_ORG_ID), inArray(tasks.id, taskIds)))
      .returning({ id: tasks.id });
    const succeeded = rows.map((r) => r.id);
    const failed = taskIds.filter((id) => !succeeded.includes(id));
    return { succeeded, failed };
  },

  async bulkDelete(taskIds: string[]) {
    if (taskIds.length === 0) return { succeeded: [] as string[], failed: [] as string[] };
    const rows = await db
      .delete(tasks)
      .where(and(eq(tasks.orgId, SINGLE_TENANT_ORG_ID), inArray(tasks.id, taskIds)))
      .returning({ id: tasks.id });
    const succeeded = rows.map((r) => r.id);
    const failed = taskIds.filter((id) => !succeeded.includes(id));
    return { succeeded, failed };
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

  async listDueToday(assignedTo: string) {
    return this.list({
      assignedTo,
      status: "open",
      dueAfter: startOfTodayIso(),
      dueBefore: endOfTodayIso(),
      pageSize: 20,
    });
  },
};

export { endOfTodayIso, parseTaskNotes, startOfTodayIso };
