import { userRoles, users } from "@propninja/db";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { toCsv } from "../lib/csv.js";
import type { Database } from "../lib/db.js";
import { deriveUsernameFromEmail } from "../lib/deriveUsername.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import {
  assertCanRemoveAdminPrivileges,
  countActiveAdmins,
  isLastActiveAdmin,
} from "../lib/lastAdminGuard.js";
import { hashPassword } from "../lib/password.js";
import { validatePasswordPolicy } from "../lib/passwordPolicy.js";
import { defaultRoleLabel } from "../lib/role-mapping.js";
import type {
  CreateUserInput,
  ListUsersQuery,
  ResetUserPasswordInput,
  UpdateUserInput,
  UserExportQuery,
  UserScopeCountsQuery,
} from "../lib/validators/users.js";
import type { AuthUser } from "../middleware/auth.js";
import { setUserPassword } from "../services/passwordHistoryService.js";
import { revokeAllUserSessions } from "../services/tokenRevocationService.js";

type UserRow = typeof users.$inferSelect;

function toPublicUser(row: UserRow, activeAdminCount?: number) {
  const { passwordHash: _passwordHash, ...publicUser } = row;
  return {
    ...publicUser,
    isLastAdmin:
      activeAdminCount !== undefined ? isLastActiveAdmin(row, activeAdminCount) : undefined,
  };
}

function resolveDisplayName(input: {
  name?: string;
  firstName?: string;
  lastName?: string;
  username: string;
}) {
  if (input.name?.trim()) return input.name.trim();
  const fromParts = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return fromParts || input.username;
}

function trimOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildUserSearchFilters(search?: string) {
  const filters = [eq(users.orgId, SINGLE_TENANT_ORG_ID)];

  if (search) {
    const term = `%${search}%`;
    filters.push(
      or(
        ilike(users.name, term),
        ilike(users.email, term),
        ilike(users.username, term),
        ilike(users.firstName, term),
        ilike(users.lastName, term),
        ilike(users.workEmail, term),
      )!,
    );
  }

  return filters;
}

function applyUserStatusFilter(
  filters: ReturnType<typeof buildUserSearchFilters>,
  status: "active" | "inactive" | "all",
  legacyIsActive?: boolean,
) {
  if (status === "active") {
    filters.push(eq(users.isActive, true));
  } else if (status === "inactive") {
    filters.push(eq(users.isActive, false));
  } else if (legacyIsActive !== undefined) {
    filters.push(eq(users.isActive, legacyIsActive));
  }
}

function buildUserListFilters(
  query: Pick<ListUsersQuery, "search" | "role" | "status" | "isActive">,
  viewer?: AuthUser,
) {
  const filters = buildUserSearchFilters(query.search);

  if (query.role) {
    filters.push(eq(users.role, query.role));
  }

  applyUserStatusFilter(filters, query.status ?? "all", query.isActive);

  if (viewer?.role === "manager") {
    filters.push(
      or(
        eq(users.reportingToId, viewer.id),
        eq(users.generalManagerId, viewer.id),
        eq(users.id, viewer.id),
      )!,
    );
  }

  return and(...filters);
}

const USER_EXPORT_HEADERS = [
  "Username",
  "Full Name",
  "First Name",
  "Last Name",
  "Email",
  "Work Email",
  "Role Label",
  "Role",
  "Department",
  "Designation",
  "Work Phone",
  "Status",
  "Created At",
] as const;

export function createUserService(db: Database) {
  return {
    async list(query: ListUsersQuery, viewer?: AuthUser) {
      const whereClause = buildUserListFilters(query, viewer);
      const offset = (query.page - 1) * query.pageSize;
      const activeAdminCount = await countActiveAdmins(db);

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
        items: rows.map((row) => toPublicUser(row, activeAdminCount)),
        page: query.page,
        pageSize: query.pageSize,
        total: Number(count),
      };
    },

    async exportCsv(query: UserExportQuery, viewer?: AuthUser) {
      const whereClause = buildUserListFilters(query, viewer);

      const rows = await db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(10_000);

      return toCsv(
        [...USER_EXPORT_HEADERS],
        rows.map((row) => [
          row.username,
          row.name,
          row.firstName,
          row.lastName,
          row.email,
          row.workEmail,
          row.roleLabel ?? defaultRoleLabel(row.role),
          row.role,
          row.department,
          row.designation,
          row.workPhone ?? row.phone,
          row.isActive ? "Active" : "Inactive",
          row.createdAt.toISOString(),
        ]),
      );
    },

    async getScopeCounts(query: UserScopeCountsQuery) {
      const shared = buildUserSearchFilters(query.search);

      const [allRow, activeRow, inactiveRow] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(and(...shared)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(and(...shared, eq(users.isActive, true))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(and(...shared, eq(users.isActive, false))),
      ]);

      return {
        all: Number(allRow[0]?.count ?? 0),
        active: Number(activeRow[0]?.count ?? 0),
        inactive: Number(inactiveRow[0]?.count ?? 0),
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

      const activeAdminCount = await countActiveAdmins(db);
      return toPublicUser(row, activeAdminCount);
    },

    async listRoles() {
      return db.select().from(userRoles).orderBy(asc(userRoles.name));
    },

    async create(payload: CreateUserInput) {
      const email = payload.email.toLowerCase();
      let username = payload.username.toLowerCase();

      const passwordPolicy = validatePasswordPolicy(payload.password);
      if (!passwordPolicy.valid) {
        throw conflict(passwordPolicy.errors[0] ?? "Invalid password", "VALIDATION_ERROR");
      }

      const [existingEmail] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingEmail) {
        throw conflict("Email already in use", "EMAIL_IN_USE");
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = attempt === 0 ? username : `${username}${attempt}`;
        const [existingUsername] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, candidate))
          .limit(1);

        if (!existingUsername) {
          username = candidate;
          break;
        }

        if (attempt === 4) {
          username = `${deriveUsernameFromEmail(email)}.${Date.now().toString(36)}`.slice(0, 50);
        }
      }

      const passwordHash = await hashPassword(payload.password);
      const name = resolveDisplayName({
        name: payload.name,
        firstName: payload.firstName,
        lastName: payload.lastName,
        username,
      });

      const [row] = await db
        .insert(users)
        .values({
          orgId: SINGLE_TENANT_ORG_ID,
          username,
          email,
          name,
          firstName: trimOptional(payload.firstName) ?? null,
          lastName: trimOptional(payload.lastName) ?? null,
          workEmail: trimOptional(payload.workEmail) ?? email,
          workPhone: trimOptional(payload.workPhone) ?? trimOptional(payload.phone) ?? null,
          personalPhone: trimOptional(payload.personalPhone) ?? null,
          homeLocation: trimOptional(payload.homeLocation) ?? null,
          department: trimOptional(payload.department) ?? null,
          designation: trimOptional(payload.designation) ?? null,
          timeZone: trimOptional(payload.timeZone) ?? null,
          brokerNumber: trimOptional(payload.brokerNumber) ?? null,
          description: trimOptional(payload.description) ?? null,
          roleLabel: trimOptional(payload.roleLabel) ?? defaultRoleLabel(payload.role),
          generalManagerId: payload.generalManagerId ?? null,
          reportingToId: payload.reportingToId ?? null,
          role: payload.role,
          phone: trimOptional(payload.phone) ?? trimOptional(payload.workPhone) ?? null,
          passwordHash,
          isActive: payload.isActive ?? true,
          isFirstLogin: true,
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

      if (payload.username) {
        const username = payload.username.toLowerCase();
        const [duplicate] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, username), ne(users.id, id)))
          .limit(1);

        if (duplicate) {
          throw conflict("This username is already taken", "USERNAME_IN_USE");
        }
      }

      await assertCanRemoveAdminPrivileges(db, existing, payload);

      const update: Partial<typeof users.$inferInsert> = {};

      if (payload.username !== undefined) update.username = payload.username.toLowerCase();
      if (payload.name !== undefined) update.name = payload.name.trim();
      if (payload.email !== undefined) update.email = payload.email.toLowerCase();
      if (payload.phone !== undefined) update.phone = trimOptional(payload.phone);
      if (payload.role !== undefined) update.role = payload.role;
      if (payload.isActive !== undefined) update.isActive = payload.isActive;
      if (payload.firstName !== undefined) update.firstName = trimOptional(payload.firstName);
      if (payload.lastName !== undefined) update.lastName = trimOptional(payload.lastName);
      if (payload.workEmail !== undefined) update.workEmail = trimOptional(payload.workEmail);
      if (payload.workPhone !== undefined) update.workPhone = trimOptional(payload.workPhone);
      if (payload.personalPhone !== undefined) {
        update.personalPhone = trimOptional(payload.personalPhone);
      }
      if (payload.homeLocation !== undefined)
        update.homeLocation = trimOptional(payload.homeLocation);
      if (payload.department !== undefined) update.department = trimOptional(payload.department);
      if (payload.designation !== undefined) update.designation = trimOptional(payload.designation);
      if (payload.timeZone !== undefined) update.timeZone = trimOptional(payload.timeZone);
      if (payload.brokerNumber !== undefined)
        update.brokerNumber = trimOptional(payload.brokerNumber);
      if (payload.description !== undefined) update.description = trimOptional(payload.description);
      if (payload.roleLabel !== undefined) update.roleLabel = trimOptional(payload.roleLabel);
      if (payload.generalManagerId !== undefined) {
        update.generalManagerId = payload.generalManagerId;
      }
      if (payload.reportingToId !== undefined) update.reportingToId = payload.reportingToId;

      // Routes normalize roleLabel -> role; keep labels in sync when only role is sent.
      if (payload.role !== undefined && payload.roleLabel === undefined) {
        update.roleLabel = defaultRoleLabel(payload.role);
      }

      if (
        payload.firstName !== undefined ||
        payload.lastName !== undefined ||
        payload.username !== undefined
      ) {
        update.name = resolveDisplayName({
          name: payload.name ?? existing.name,
          firstName: payload.firstName ?? existing.firstName ?? undefined,
          lastName: payload.lastName ?? existing.lastName ?? undefined,
          username: payload.username ?? existing.username,
        });
      }

      await db.update(users).set(update).where(eq(users.id, id));

      if (payload.isActive === false && existing.isActive) {
        await revokeAllUserSessions(id);
      }

      return this.getById(id);
    },

    async resetPassword(id: string, payload: ResetUserPasswordInput) {
      const [existing] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.orgId, SINGLE_TENANT_ORG_ID)))
        .limit(1);

      if (!existing) {
        throw notFound("User not found");
      }

      const result = await setUserPassword(db, id, payload.newPassword, existing.passwordHash);
      if (!result.valid) {
        throw conflict(result.errors[0] ?? "Invalid password", "VALIDATION_ERROR");
      }

      await revokeAllUserSessions(id);

      return this.getById(id);
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
