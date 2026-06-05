import { users } from "@propninja/db";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import { hashPassword } from "../lib/password.js";
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from "../lib/validators/users.js";

type UserRow = typeof users.$inferSelect;

function toPublicUser(row: UserRow) {
  const { passwordHash: _passwordHash, ...publicUser } = row;
  return publicUser;
}

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

      return {
        rows: rows.map(toPublicUser),
        page: query.page,
        pageSize: query.pageSize,
        total: count,
      };
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

      return toPublicUser(row);
    },

    async create(payload: CreateUserInput) {
      const email = payload.email.toLowerCase();

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

      if (existing) {
        throw conflict("A user with this email already exists", "EMAIL_IN_USE");
      }

      const passwordHash = await hashPassword(payload.password);

      const [row] = await db
        .insert(users)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          email,
          name: payload.name.trim(),
          role: payload.role,
          phone: payload.phone?.trim() || null,
          passwordHash,
          isActive: true,
        })
        .returning();

      return toPublicUser(row!);
    },

    async update(id: string, payload: UpdateUserInput, actingUserId?: string) {
      const [existing] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.orgId, SINGLE_TENANT_ORG_ID)))
        .limit(1);

      if (!existing) {
        throw notFound("User not found");
      }

      if (actingUserId && actingUserId === id) {
        if (payload.isActive === false) {
          throw forbidden("You cannot deactivate your own account");
        }
        if (payload.role && payload.role !== existing.role) {
          throw forbidden("You cannot change your own role");
        }
      }

      if (payload.email) {
        const email = payload.email.toLowerCase();
        const [duplicate] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, email), ne(users.id, id)))
          .limit(1);

        if (duplicate) {
          throw conflict("A user with this email already exists", "EMAIL_IN_USE");
        }
      }

      const update: Partial<{
        name: string;
        email: string;
        phone: string | null;
        role: string;
        isActive: boolean;
        passwordHash: string;
      }> = {};

      if (payload.name !== undefined) update.name = payload.name.trim();
      if (payload.email !== undefined) update.email = payload.email.toLowerCase();
      if (payload.phone !== undefined) update.phone = payload.phone?.trim() || null;
      if (payload.role !== undefined) update.role = payload.role;
      if (payload.isActive !== undefined) update.isActive = payload.isActive;
      if (payload.password) update.passwordHash = await hashPassword(payload.password);

      const [row] = await db.update(users).set(update).where(eq(users.id, id)).returning();

      return toPublicUser(row!);
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
