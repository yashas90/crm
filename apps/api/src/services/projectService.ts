import { leads, projects, users } from "@propninja/db";
import { and, desc, eq, ilike, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { conflict, notFound } from "../lib/errors.js";
import type {
  CreateProjectInput,
  ListProjectsQuery,
  ProjectScopeCountsQuery,
  UpdateProjectInput,
} from "../lib/validators/projects.js";

function buildListFilters(query: ListProjectsQuery | ProjectScopeCountsQuery) {
  const filters = [eq(projects.orgId, SINGLE_TENANT_ORG_ID)];

  if (query.search) {
    filters.push(ilike(projects.name, `%${query.search}%`));
  }

  if ("category" in query && query.category) {
    filters.push(eq(projects.projectCategory, query.category));
  }

  return filters;
}

function optionalNumeric(value: number | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value);
}

function categoryFromProjectType(projectType: string) {
  if (projectType === "commercial") return "commercial" as const;
  if (projectType === "agricultural") return "agricultural" as const;
  return "residential" as const;
}

function mapCreatePayload(payload: CreateProjectInput): typeof projects.$inferInsert {
  return {
    orgId: SINGLE_TENANT_ORG_ID,
    name: payload.name.trim(),
    status: payload.status ?? "new",
    projectType: payload.projectType,
    projectCategory: payload.category ?? categoryFromProjectType(payload.projectType),
    subType: payload.subType?.trim() || null,
    availability: payload.availability ?? true,
    facing: payload.facing ?? null,
    landArea: payload.landArea?.trim() || null,
    certificate: payload.certificate?.trim() || null,
    description: payload.description?.trim() || null,
    notes: payload.notes?.trim() || null,
    builderName: payload.builderName?.trim() || null,
    builderPhone: payload.builderPhone?.trim() || null,
    builderContactName: payload.builderContactName?.trim() || null,
    builderContactPhone: payload.builderContactPhone?.trim() || null,
    reraNumbers: payload.reraNumbers ?? null,
    minPrice: optionalNumeric(payload.minPrice) ?? null,
    maxPrice: optionalNumeric(payload.maxPrice) ?? null,
    brokeragePercent: optionalNumeric(payload.brokeragePercent) ?? null,
    startDate: payload.startDate ?? null,
    endDate: payload.endDate ?? null,
    possessionDate: payload.possessionDate ?? null,
    assignedTo: payload.assignedTo ?? null,
    unitsInfo: payload.unitsInfo ?? null,
    blocksInfo: payload.blocksInfo ?? null,
    amenities: payload.amenities ?? null,
    gallery: payload.gallery ?? null,
  };
}

function mapUpdatePayload(payload: UpdateProjectInput): Partial<typeof projects.$inferInsert> {
  const update: Partial<typeof projects.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (payload.name !== undefined) update.name = payload.name.trim();
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.projectType !== undefined) update.projectType = payload.projectType;
  if (payload.category !== undefined) update.projectCategory = payload.category;
  if (payload.subType !== undefined) update.subType = payload.subType?.trim() || null;
  if (payload.availability !== undefined) update.availability = payload.availability;
  if (payload.isActive !== undefined) update.availability = payload.isActive;
  if (payload.facing !== undefined) update.facing = payload.facing;
  if (payload.landArea !== undefined) update.landArea = payload.landArea?.trim() || null;
  if (payload.certificate !== undefined) update.certificate = payload.certificate?.trim() || null;
  if (payload.description !== undefined) update.description = payload.description?.trim() || null;
  if (payload.notes !== undefined) update.notes = payload.notes?.trim() || null;
  if (payload.builderName !== undefined) update.builderName = payload.builderName?.trim() || null;
  if (payload.builderPhone !== undefined)
    update.builderPhone = payload.builderPhone?.trim() || null;
  if (payload.builderContactName !== undefined) {
    update.builderContactName = payload.builderContactName?.trim() || null;
  }
  if (payload.builderContactPhone !== undefined) {
    update.builderContactPhone = payload.builderContactPhone?.trim() || null;
  }
  if (payload.projectType !== undefined && payload.category === undefined) {
    update.projectCategory = categoryFromProjectType(payload.projectType);
  }
  if (payload.reraNumbers !== undefined) update.reraNumbers = payload.reraNumbers;
  if (payload.minPrice !== undefined) update.minPrice = optionalNumeric(payload.minPrice) ?? null;
  if (payload.maxPrice !== undefined) update.maxPrice = optionalNumeric(payload.maxPrice) ?? null;
  if (payload.brokeragePercent !== undefined) {
    update.brokeragePercent = optionalNumeric(payload.brokeragePercent) ?? null;
  }
  if (payload.startDate !== undefined) update.startDate = payload.startDate;
  if (payload.endDate !== undefined) update.endDate = payload.endDate;
  if (payload.possessionDate !== undefined) update.possessionDate = payload.possessionDate;
  if (payload.assignedTo !== undefined) update.assignedTo = payload.assignedTo;
  if (payload.unitsInfo !== undefined) update.unitsInfo = payload.unitsInfo;
  if (payload.blocksInfo !== undefined) update.blocksInfo = payload.blocksInfo;
  if (payload.amenities !== undefined) update.amenities = payload.amenities;
  if (payload.gallery !== undefined) update.gallery = payload.gallery;

  return update;
}

async function assertUniqueName(db: Database, name: string, excludeId?: string) {
  const filters = [
    eq(projects.orgId, SINGLE_TENANT_ORG_ID),
    isNull(projects.deletedAt),
    sql`lower(${projects.name}) = lower(${name})`,
  ];

  if (excludeId) {
    filters.push(ne(projects.id, excludeId));
  }

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(...filters))
    .limit(1);

  if (existing) {
    throw conflict("A project with this name already exists", "PROJECT_NAME_IN_USE");
  }
}

export function createProjectService(db: Database) {
  return {
    async listProjects(query: ListProjectsQuery) {
      const filters = buildListFilters(query);

      if (query.deletedOnly) {
        filters.push(isNotNull(projects.deletedAt));
      } else {
        filters.push(isNull(projects.deletedAt));
      }

      if (query.statuses && query.statuses.length > 0) {
        filters.push(inArray(projects.status, query.statuses));
      } else if (query.status) {
        filters.push(eq(projects.status, query.status));
      }

      const availability = query.availability ?? query.isActive;
      if (availability !== undefined) {
        filters.push(eq(projects.availability, availability));
      }

      if (query.assignedTo) {
        filters.push(eq(projects.assignedTo, query.assignedTo));
      }

      const whereClause = and(...filters);
      const offset = (query.page - 1) * query.pageSize;

      const [rows, [{ count }]] = await Promise.all([
        db
          .select()
          .from(projects)
          .leftJoin(users, eq(projects.assignedTo, users.id))
          .where(whereClause)
          .orderBy(desc(projects.createdAt))
          .limit(query.pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(projects).where(whereClause),
      ]);

      const projectIds = rows.map((row) => row.projects.id);
      let unitSummaries: Record<string, import("./projectUnitService.js").UnitSummary> = {};
      if (query.includeUnitSummary && projectIds.length > 0) {
        const { createProjectUnitService } = await import("./projectUnitService.js");
        unitSummaries = await createProjectUnitService(db).getSummariesForProjects(projectIds);
      }

      return {
        items: rows.map((row) => ({
          ...row.projects,
          assignedUser: row.users
            ? { id: row.users.id, name: row.users.name, email: row.users.email }
            : null,
          ...(query.includeUnitSummary
            ? { unitSummary: unitSummaries[row.projects.id] ?? null }
            : {}),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: Number(count),
      };
    },

    async getScopeCounts(query: ProjectScopeCountsQuery) {
      const shared = buildListFilters(query);

      const [activeRow, deletedRow] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(projects)
          .where(and(...shared, isNull(projects.deletedAt))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(projects)
          .where(and(...shared, isNotNull(projects.deletedAt))),
      ]);

      return {
        all: Number(activeRow[0]?.count ?? 0),
        deleted: Number(deletedRow[0]?.count ?? 0),
      };
    },

    async getProjectById(id: string) {
      const [row] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, id),
            eq(projects.orgId, SINGLE_TENANT_ORG_ID),
            isNull(projects.deletedAt),
          ),
        )
        .limit(1);

      if (!row) {
        throw notFound("Project not found");
      }

      return row;
    },

    async createProject(payload: CreateProjectInput) {
      const name = payload.name.trim();
      await assertUniqueName(db, name);

      const [row] = await db.insert(projects).values(mapCreatePayload(payload)).returning();

      return row!;
    },

    async updateProject(id: string, payload: UpdateProjectInput) {
      const existing = await this.getProjectById(id);

      if (payload.name) {
        await assertUniqueName(db, payload.name.trim(), id);
      }

      const [row] = await db
        .update(projects)
        .set(mapUpdatePayload(payload))
        .where(eq(projects.id, id))
        .returning();

      if (row && payload.name !== undefined && payload.name !== existing.name) {
        await db
          .update(leads)
          .set({ projectName: row.name, updatedAt: new Date() })
          .where(and(eq(leads.projectId, id), isNull(leads.deletedAt)));
      }

      return row!;
    },

    async softDeleteProject(id: string) {
      await this.getProjectById(id);

      const now = new Date();

      await db
        .update(leads)
        .set({ projectId: null, updatedAt: now })
        .where(and(eq(leads.projectId, id), isNull(leads.deletedAt)));

      const [row] = await db
        .update(projects)
        .set({ deletedAt: now, updatedAt: now, availability: false })
        .where(eq(projects.id, id))
        .returning();

      return row!;
    },

    async toggleAvailability(id: string, availability: boolean) {
      await this.getProjectById(id);

      const [row] = await db
        .update(projects)
        .set({ availability, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();

      return row!;
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
