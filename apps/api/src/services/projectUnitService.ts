import { leadActivities, leads, projectUnits, projects } from "@propninja/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { expandUnitNumberRange } from "../lib/unitNumberRange.js";
import type {
  CreateProjectUnitsBody,
  ListProjectUnitsQuery,
  UnitStatus,
  UpdateProjectUnitInput,
} from "../lib/validators/projectUnits.js";
import { createProjectService } from "./projectService.js";

export type UnitSummary = {
  total: number;
  available: number;
  reserved: number;
  booked: number;
  sold: number;
};

export const UNIT_STATUS_TRANSITIONS: Record<UnitStatus, UnitStatus[]> = {
  available: ["reserved", "booked", "sold"],
  reserved: ["available", "booked", "sold"],
  booked: ["available", "reserved", "sold"],
  sold: ["available", "reserved", "booked"],
};

export function assertValidStatusTransition(from: UnitStatus, to: UnitStatus) {
  if (from === to) return;
  if (!UNIT_STATUS_TRANSITIONS[from].includes(to)) {
    throw badRequest(
      `Cannot change unit status from ${from} to ${to}`,
      undefined,
      "INVALID_STATUS_TRANSITION",
    );
  }
}

function mapUnitRow(
  row: typeof projectUnits.$inferSelect,
  lead?: { id: string; firstName: string; lastName: string } | null,
) {
  return {
    ...row,
    areaSqFt: String(row.areaSqFt),
    assignedLead: lead ? { id: lead.id, name: `${lead.firstName} ${lead.lastName}`.trim() } : null,
  };
}

async function assertProjectExists(db: Database, projectId: string) {
  const service = createProjectService(db);
  return service.getProjectById(projectId);
}

async function clearLeadFromOtherUnits(
  db: Database,
  projectId: string,
  leadId: string,
  exceptUnitId?: string,
) {
  const filters = [eq(projectUnits.projectId, projectId), eq(projectUnits.assignedLeadId, leadId)];
  if (exceptUnitId) {
    filters.push(sql`${projectUnits.id} <> ${exceptUnitId}`);
  }
  await db
    .update(projectUnits)
    .set({ assignedLeadId: null, updatedAt: new Date() })
    .where(and(...filters));
}

async function syncLeadOnUnitBooked(
  db: Database,
  params: {
    leadId: string;
    actorUserId: string;
    projectId: string;
    projectName: string;
    unitId: string;
    unitNumber: string;
  },
) {
  const [lead] = await db
    .select({ id: leads.id, leadStatus: leads.leadStatus })
    .from(leads)
    .where(
      and(
        eq(leads.orgId, SINGLE_TENANT_ORG_ID),
        eq(leads.id, params.leadId),
        sql`${leads.deletedAt} IS NULL`,
      ),
    )
    .limit(1);

  if (!lead) return;

  const previousStatus = lead.leadStatus;
  if (previousStatus !== "won") {
    await db
      .update(leads)
      .set({ leadStatus: "won", updatedAt: new Date() })
      .where(eq(leads.id, params.leadId));
  }

  await db.insert(leadActivities).values({
    orgId: SINGLE_TENANT_ORG_ID,
    leadId: params.leadId,
    userId: params.actorUserId,
    type: "status_change",
    metadata: {
      kind: "unit_booked",
      from: previousStatus,
      to: "won",
      projectId: params.projectId,
      projectName: params.projectName,
      unitId: params.unitId,
      unitNumber: params.unitNumber,
    },
  });
}

export function createProjectUnitService(db: Database) {
  return {
    async listUnits(projectId: string, query: ListProjectUnitsQuery) {
      await assertProjectExists(db, projectId);

      const filters = [eq(projectUnits.projectId, projectId)];
      if (query.status) filters.push(eq(projectUnits.status, query.status));
      if (query.bedrooms !== undefined) filters.push(eq(projectUnits.bedrooms, query.bedrooms));
      if (query.floor !== undefined) filters.push(eq(projectUnits.floor, query.floor));

      const rows = await db
        .select({
          unit: projectUnits,
          lead: leads,
        })
        .from(projectUnits)
        .leftJoin(leads, eq(projectUnits.assignedLeadId, leads.id))
        .where(and(...filters))
        .orderBy(asc(projectUnits.floor), asc(projectUnits.unitNumber));

      return rows.map((row) =>
        mapUnitRow(
          row.unit,
          row.lead
            ? { id: row.lead.id, firstName: row.lead.firstName, lastName: row.lead.lastName }
            : null,
        ),
      );
    },

    async getUnitSummary(projectId: string): Promise<UnitSummary> {
      await assertProjectExists(db, projectId);

      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          available: sql<number>`count(*) filter (where ${projectUnits.status} = 'available')::int`,
          reserved: sql<number>`count(*) filter (where ${projectUnits.status} = 'reserved')::int`,
          booked: sql<number>`count(*) filter (where ${projectUnits.status} = 'booked')::int`,
          sold: sql<number>`count(*) filter (where ${projectUnits.status} = 'sold')::int`,
        })
        .from(projectUnits)
        .where(eq(projectUnits.projectId, projectId));

      return {
        total: Number(row?.total ?? 0),
        available: Number(row?.available ?? 0),
        reserved: Number(row?.reserved ?? 0),
        booked: Number(row?.booked ?? 0),
        sold: Number(row?.sold ?? 0),
      };
    },

    async getSummariesForProjects(projectIds: string[]): Promise<Record<string, UnitSummary>> {
      if (projectIds.length === 0) return {};

      const rows = await db
        .select({
          projectId: projectUnits.projectId,
          total: sql<number>`count(*)::int`,
          available: sql<number>`count(*) filter (where ${projectUnits.status} = 'available')::int`,
          reserved: sql<number>`count(*) filter (where ${projectUnits.status} = 'reserved')::int`,
          booked: sql<number>`count(*) filter (where ${projectUnits.status} = 'booked')::int`,
          sold: sql<number>`count(*) filter (where ${projectUnits.status} = 'sold')::int`,
        })
        .from(projectUnits)
        .where(inArray(projectUnits.projectId, projectIds))
        .groupBy(projectUnits.projectId);

      const result: Record<string, UnitSummary> = {};
      for (const row of rows) {
        result[row.projectId] = {
          total: Number(row.total),
          available: Number(row.available),
          reserved: Number(row.reserved),
          booked: Number(row.booked),
          sold: Number(row.sold),
        };
      }
      return result;
    },

    async createUnits(projectId: string, body: CreateProjectUnitsBody) {
      await assertProjectExists(db, projectId);

      let toInsert: Array<typeof projectUnits.$inferInsert> = [];

      if ("bulk" in body) {
        const numbers = expandUnitNumberRange(body.bulk.unitNumberFrom, body.bulk.unitNumberTo);
        toInsert = numbers.map((unitNumber) => ({
          projectId,
          unitNumber,
          floor: body.bulk.floor,
          bedrooms: body.bulk.bedrooms,
          areaSqFt: String(body.bulk.areaSqFt),
          priceListedRs: body.bulk.priceListedRs,
          notes: body.bulk.notes ?? null,
          status: "available" as const,
        }));
      } else if ("units" in body) {
        toInsert = body.units.map((u) => ({
          projectId,
          unitNumber: u.unitNumber,
          floor: u.floor,
          bedrooms: u.bedrooms,
          areaSqFt: String(u.areaSqFt),
          status: u.status ?? "available",
          priceListedRs: u.priceListedRs,
          priceFinalRs: u.priceFinalRs ?? null,
          notes: u.notes ?? null,
        }));
      } else {
        const u = body.unit;
        toInsert = [
          {
            projectId,
            unitNumber: u.unitNumber,
            floor: u.floor,
            bedrooms: u.bedrooms,
            areaSqFt: String(u.areaSqFt),
            status: u.status ?? "available",
            priceListedRs: u.priceListedRs,
            priceFinalRs: u.priceFinalRs ?? null,
            notes: u.notes ?? null,
          },
        ];
      }

      if (toInsert.length === 0) {
        throw badRequest("No units to create");
      }

      try {
        const rows = await db.insert(projectUnits).values(toInsert).returning();
        return rows.map((row) => mapUnitRow(row, null));
      } catch (err) {
        if (err && typeof err === "object" && "code" in err && err.code === "23505") {
          throw conflict(
            "One or more unit numbers already exist in this project",
            "UNIT_NUMBER_EXISTS",
          );
        }
        throw err;
      }
    },

    async updateUnit(
      projectId: string,
      unitId: string,
      payload: UpdateProjectUnitInput,
      options?: { actorUserId?: string },
    ) {
      await assertProjectExists(db, projectId);

      const [existing] = await db
        .select()
        .from(projectUnits)
        .where(and(eq(projectUnits.id, unitId), eq(projectUnits.projectId, projectId)))
        .limit(1);

      if (!existing) {
        throw notFound("Unit not found");
      }

      const nextStatus = (payload.status ?? existing.status) as UnitStatus;
      if (payload.status) {
        assertValidStatusTransition(existing.status as UnitStatus, payload.status);
      }

      const update: Partial<typeof projectUnits.$inferInsert> = { updatedAt: new Date() };

      if (payload.status !== undefined) update.status = payload.status;
      if (payload.priceListedRs !== undefined) update.priceListedRs = payload.priceListedRs;
      if (payload.priceFinalRs !== undefined) update.priceFinalRs = payload.priceFinalRs;
      if (payload.notes !== undefined) update.notes = payload.notes;
      if (payload.floor !== undefined) update.floor = payload.floor;
      if (payload.bedrooms !== undefined) update.bedrooms = payload.bedrooms;
      if (payload.areaSqFt !== undefined) update.areaSqFt = String(payload.areaSqFt);

      if (payload.assignedLeadId !== undefined) {
        if (payload.assignedLeadId) {
          const [lead] = await db
            .select({ id: leads.id })
            .from(leads)
            .where(
              and(
                eq(leads.orgId, SINGLE_TENANT_ORG_ID),
                eq(leads.id, payload.assignedLeadId),
                sql`${leads.deletedAt} IS NULL`,
              ),
            )
            .limit(1);
          if (!lead) throw notFound("Lead not found");
          await clearLeadFromOtherUnits(db, projectId, payload.assignedLeadId, unitId);
          update.assignedLeadId = payload.assignedLeadId;
          if (!payload.status && existing.status === "available") {
            update.status = "reserved";
          }
        } else {
          update.assignedLeadId = null;
        }
      }

      if (nextStatus === "available") {
        update.assignedLeadId = null;
      }

      if (
        (nextStatus === "reserved" || nextStatus === "booked") &&
        payload.assignedLeadId === undefined &&
        !existing.assignedLeadId &&
        !update.assignedLeadId
      ) {
        throw badRequest(
          "Reserved or booked units must have an assigned lead",
          undefined,
          "LEAD_REQUIRED",
        );
      }

      const [row] = await db
        .update(projectUnits)
        .set(update)
        .where(eq(projectUnits.id, unitId))
        .returning();

      const [joined] = await db
        .select({ unit: projectUnits, lead: leads, project: projects })
        .from(projectUnits)
        .leftJoin(leads, eq(projectUnits.assignedLeadId, leads.id))
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .where(eq(projectUnits.id, row!.id))
        .limit(1);

      const transitionedToBooked = existing.status !== "booked" && joined!.unit.status === "booked";

      if (transitionedToBooked && options?.actorUserId && joined!.lead && joined!.project) {
        await syncLeadOnUnitBooked(db, {
          leadId: joined!.lead.id,
          actorUserId: options.actorUserId,
          projectId,
          projectName: joined!.project.name,
          unitId,
          unitNumber: joined!.unit.unitNumber,
        });
      }

      return {
        ...mapUnitRow(
          joined!.unit,
          joined!.lead
            ? {
                id: joined!.lead.id,
                firstName: joined!.lead.firstName,
                lastName: joined!.lead.lastName,
              }
            : null,
        ),
        transitionedToBooked,
      };
    },

    async deleteUnit(projectId: string, unitId: string) {
      await assertProjectExists(db, projectId);

      const [row] = await db
        .delete(projectUnits)
        .where(and(eq(projectUnits.id, unitId), eq(projectUnits.projectId, projectId)))
        .returning();

      if (!row) {
        throw notFound("Unit not found");
      }

      return row;
    },

    async exportCsv(projectId: string): Promise<string> {
      const units = await this.listUnits(projectId, {});
      const header =
        "unit_number,floor,bedrooms,area_sq_ft,status,price_listed_rs,price_final_rs,assigned_lead,notes";
      const lines = units.map((u) => {
        const cols = [
          u.unitNumber,
          u.floor,
          u.bedrooms,
          u.areaSqFt,
          u.status,
          u.priceListedRs,
          u.priceFinalRs ?? "",
          u.assignedLead?.name ?? "",
          (u.notes ?? "").replace(/"/g, '""'),
        ];
        return cols.map((c) => `"${String(c)}"`).join(",");
      });
      return [header, ...lines].join("\n");
    },

    async getInterestedUnitForLead(leadId: string) {
      const [row] = await db
        .select({
          unit: projectUnits,
          project: projects,
        })
        .from(projectUnits)
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .where(
          and(
            eq(projectUnits.assignedLeadId, leadId),
            eq(projects.orgId, SINGLE_TENANT_ORG_ID),
            sql`${projects.deletedAt} IS NULL`,
          ),
        )
        .limit(1);

      if (!row) return null;

      return {
        id: row.unit.id,
        unitNumber: row.unit.unitNumber,
        floor: row.unit.floor,
        bedrooms: row.unit.bedrooms,
        areaSqFt: String(row.unit.areaSqFt),
        status: row.unit.status,
        priceListedRs: Number(row.unit.priceListedRs),
        priceFinalRs: row.unit.priceFinalRs != null ? Number(row.unit.priceFinalRs) : null,
        projectId: row.project.id,
        projectName: row.project.name,
      };
    },

    async getUnitWithLeadAccess(projectId: string, unitId: string) {
      const [row] = await db
        .select({
          unit: projectUnits,
          lead: leads,
        })
        .from(projectUnits)
        .leftJoin(leads, eq(projectUnits.assignedLeadId, leads.id))
        .where(and(eq(projectUnits.id, unitId), eq(projectUnits.projectId, projectId)))
        .limit(1);

      if (!row) return null;

      return {
        unit: row.unit,
        leadAssignedTo: row.lead?.assignedTo ?? null,
        leadId: row.lead?.id ?? null,
      };
    },
  };
}

export type ProjectUnitService = ReturnType<typeof createProjectUnitService>;
