import { users } from "@propninja/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import type { ListUsersQuery, UpdateUserInput } from "../lib/validators/users.js";

export function createUserService(db: Database) {
  return {
    async list(query: ListUsersQuery) {
      const filters = [eq(users.orgId, SINGLE_TENANT_ORG_ID)];

      if (query.search) {
        filters.push(
          or(ilike(users.name, `%${query.search}%`), ilike(users.email, `%${query.search}%`))!,
        );
      }

      if (query.role) {
        filters.push(eq(users.role, query.role));
      }

      if (query.isActive !== undefined) {
        filters.push(eq(users.isActive, query.isActive));
      }

      const whereClause = and(...filters);
      const offset = (query.page - 1) * query.pageSize;

      const rows = await db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(query.pageSize)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(whereClause);

      return { rows, page: query.page, pageSize: query.pageSize, total: count };
    },

    async getById(id: string) {
      const [row] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.orgId, SINGLE_TENANT_ORG_ID)))
        .limit(1);

      if (!row) {
        throw notFound("User not found");
      }

      return row;
    },

    async update(id: string, payload: UpdateUserInput) {
      const [existing] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.orgId, SINGLE_TENANT_ORG_ID)))
        .limit(1);

      if (!existing) {
        throw notFound("User not found");
      }

      const update: Partial<{ role: string; isActive: boolean }> = {};
      if (payload.role !== undefined) update.role = payload.role;
      if (payload.isActive !== undefined) update.isActive = payload.isActive;

      const [row] = await db.update(users).set(update).where(eq(users.id, id)).returning();

      return row!;
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
