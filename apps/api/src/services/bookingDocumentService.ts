import {
  bookingDocuments,
  leads,
  organizations,
  projectUnits,
  projects,
  users,
} from "@propninja/db";
import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { buildBookingFileKey, buildBookingPdfBuffer, buildBookingRef } from "../lib/bookingPdf.js";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import type { Database } from "../lib/db.js";
import { badRequest, notFound } from "../lib/errors.js";
import {
  createSignedDownloadUrl,
  isR2Configured,
  publicFileUrl,
  uploadToR2,
} from "../lib/r2Storage.js";
import type { ListBookingsQuery } from "../lib/validators/bookings.js";

export type BookingDocumentRow = typeof bookingDocuments.$inferSelect;

export function createBookingDocumentService(db: Database) {
  return {
    async generateForBookedUnit(params: {
      projectId: string;
      unitId: string;
      actorUserId: string;
    }): Promise<BookingDocumentRow> {
      if (!isR2Configured()) {
        throw badRequest(
          "File storage is not configured. Set Cloudflare R2 environment variables.",
          undefined,
          "STORAGE_NOT_CONFIGURED",
        );
      }

      const [row] = await db
        .select({
          unit: projectUnits,
          project: projects,
          lead: leads,
          agent: users,
          org: organizations,
        })
        .from(projectUnits)
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .leftJoin(leads, eq(projectUnits.assignedLeadId, leads.id))
        .leftJoin(users, eq(leads.assignedTo, users.id))
        .innerJoin(organizations, eq(projects.orgId, organizations.id))
        .where(
          and(
            eq(projectUnits.id, params.unitId),
            eq(projectUnits.projectId, params.projectId),
            eq(projects.orgId, SINGLE_TENANT_ORG_ID),
            isNull(projects.deletedAt),
          ),
        )
        .limit(1);

      if (!row) {
        throw notFound("Unit not found");
      }

      if (row.unit.status !== "booked") {
        throw badRequest(
          "Unit must be booked to generate a booking summary",
          undefined,
          "NOT_BOOKED",
        );
      }

      if (!row.lead) {
        throw badRequest("Booked unit must have an assigned lead", undefined, "LEAD_REQUIRED");
      }

      const generatedAt = new Date();
      const bookingRef = buildBookingRef(params.unitId, generatedAt);
      const fileKey = buildBookingFileKey(params.projectId, params.unitId, generatedAt);
      const leadName = `${row.lead.firstName} ${row.lead.lastName}`.trim();
      const agentName =
        row.agent?.name ??
        (await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, params.actorUserId))
          .limit(1)
          .then((r) => r[0]?.name ?? "—"));

      const pdfBuffer = await buildBookingPdfBuffer({
        orgName: row.org.name,
        bookingRef,
        generatedAt,
        projectName: row.project.name,
        unitNumber: row.unit.unitNumber,
        floor: row.unit.floor,
        bedrooms: row.unit.bedrooms,
        areaSqFt: String(row.unit.areaSqFt),
        priceListedRs: Number(row.unit.priceListedRs),
        priceFinalRs: row.unit.priceFinalRs != null ? Number(row.unit.priceFinalRs) : null,
        leadName,
        leadPhone: row.lead.phone ?? "",
        agentName: agentName ?? "—",
      });

      await uploadToR2(fileKey, pdfBuffer, "application/pdf");
      const fileUrl = publicFileUrl(fileKey);
      const agentId = row.agent?.id ?? params.actorUserId;

      const [doc] = await db
        .insert(bookingDocuments)
        .values({
          unitId: params.unitId,
          leadId: row.lead.id,
          agentId,
          fileKey,
          fileUrl,
          bookingRef,
          generatedAt,
        })
        .returning();

      return doc!;
    },

    async getLatestForUnit(unitId: string): Promise<BookingDocumentRow | null> {
      const [row] = await db
        .select()
        .from(bookingDocuments)
        .where(eq(bookingDocuments.unitId, unitId))
        .orderBy(desc(bookingDocuments.generatedAt))
        .limit(1);
      return row ?? null;
    },

    async getSignedDownloadUrl(projectId: string, unitId: string) {
      const [unit] = await db
        .select({ id: projectUnits.id })
        .from(projectUnits)
        .where(and(eq(projectUnits.id, unitId), eq(projectUnits.projectId, projectId)))
        .limit(1);

      if (!unit) {
        throw notFound("Unit not found");
      }

      const doc = await this.getLatestForUnit(unitId);
      if (!doc) {
        throw notFound("Booking document not found");
      }

      const signedUrl = await createSignedDownloadUrl(doc.fileKey, {
        downloadFilename: `${doc.bookingRef}.pdf`,
        mimeType: "application/pdf",
        forceAttachment: true,
      });

      return {
        signedUrl,
        expiresInSeconds: 3600,
        bookingRef: doc.bookingRef,
        generatedAt: doc.generatedAt.toISOString(),
      };
    },

    async countInRange(dateFrom: Date, dateTo: Date): Promise<number> {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookingDocuments)
        .innerJoin(projectUnits, eq(bookingDocuments.unitId, projectUnits.id))
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .where(
          and(
            eq(projects.orgId, SINGLE_TENANT_ORG_ID),
            gte(bookingDocuments.generatedAt, dateFrom),
            lte(bookingDocuments.generatedAt, dateTo),
          ),
        );
      return row?.count ?? 0;
    },

    async listInRange(dateFrom: Date, dateTo: Date) {
      const rows = await db
        .select({
          id: bookingDocuments.id,
          bookingRef: bookingDocuments.bookingRef,
          generatedAt: bookingDocuments.generatedAt,
          unitId: projectUnits.id,
          unitNumber: projectUnits.unitNumber,
          floor: projectUnits.floor,
          bedrooms: projectUnits.bedrooms,
          status: projectUnits.status,
          projectId: projects.id,
          projectName: projects.name,
          leadName: sql<string>`trim(coalesce(${leads.firstName}, '') || ' ' || coalesce(${leads.lastName}, ''))`,
        })
        .from(bookingDocuments)
        .innerJoin(projectUnits, eq(bookingDocuments.unitId, projectUnits.id))
        .innerJoin(projects, eq(projectUnits.projectId, projects.id))
        .leftJoin(leads, eq(bookingDocuments.leadId, leads.id))
        .where(
          and(
            eq(projects.orgId, SINGLE_TENANT_ORG_ID),
            gte(bookingDocuments.generatedAt, dateFrom),
            lte(bookingDocuments.generatedAt, dateTo),
          ),
        )
        .orderBy(desc(bookingDocuments.generatedAt));

      return rows.map((row) => ({
        ...row,
        generatedAt: row.generatedAt.toISOString(),
      }));
    },

    async listBookings(query: ListBookingsQuery, scope?: { agentId?: string }) {
      const filters = [eq(projects.orgId, SINGLE_TENANT_ORG_ID), isNull(projects.deletedAt)];

      if (query.dateFrom) {
        filters.push(gte(bookingDocuments.generatedAt, query.dateFrom));
      }
      if (query.dateTo) {
        filters.push(lte(bookingDocuments.generatedAt, query.dateTo));
      }
      if (query.projectId) {
        filters.push(eq(projects.id, query.projectId));
      }
      if (query.agentId) {
        filters.push(eq(bookingDocuments.agentId, query.agentId));
      }
      if (scope?.agentId) {
        filters.push(
          or(eq(bookingDocuments.agentId, scope.agentId), eq(leads.assignedTo, scope.agentId))!,
        );
      }
      if (query.search) {
        const pattern = `%${query.search}%`;
        filters.push(
          or(
            ilike(bookingDocuments.bookingRef, pattern),
            ilike(projects.name, pattern),
            ilike(projectUnits.unitNumber, pattern),
            ilike(
              sql`trim(coalesce(${leads.firstName}, '') || ' ' || coalesce(${leads.lastName}, ''))`,
              pattern,
            ),
          )!,
        );
      }

      const whereClause = and(...filters);
      const offset = (query.page - 1) * query.pageSize;

      const [rows, [{ count }]] = await Promise.all([
        db
          .select({
            id: bookingDocuments.id,
            bookingRef: bookingDocuments.bookingRef,
            generatedAt: bookingDocuments.generatedAt,
            unitId: projectUnits.id,
            unitNumber: projectUnits.unitNumber,
            floor: projectUnits.floor,
            bedrooms: projectUnits.bedrooms,
            status: projectUnits.status,
            priceListedRs: projectUnits.priceListedRs,
            priceFinalRs: projectUnits.priceFinalRs,
            projectId: projects.id,
            projectName: projects.name,
            leadId: bookingDocuments.leadId,
            leadName: sql<string>`trim(coalesce(${leads.firstName}, '') || ' ' || coalesce(${leads.lastName}, ''))`,
            agentId: bookingDocuments.agentId,
            agentName: sql<string>`coalesce(${users.name}, '—')`,
          })
          .from(bookingDocuments)
          .innerJoin(projectUnits, eq(bookingDocuments.unitId, projectUnits.id))
          .innerJoin(projects, eq(projectUnits.projectId, projects.id))
          .leftJoin(leads, eq(bookingDocuments.leadId, leads.id))
          .leftJoin(users, eq(bookingDocuments.agentId, users.id))
          .where(whereClause)
          .orderBy(desc(bookingDocuments.generatedAt))
          .limit(query.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(bookingDocuments)
          .innerJoin(projectUnits, eq(bookingDocuments.unitId, projectUnits.id))
          .innerJoin(projects, eq(projectUnits.projectId, projects.id))
          .leftJoin(leads, eq(bookingDocuments.leadId, leads.id))
          .where(whereClause),
      ]);

      return {
        items: rows.map((row) => ({
          id: row.id,
          bookingRef: row.bookingRef,
          generatedAt: row.generatedAt.toISOString(),
          unitId: row.unitId,
          unitNumber: row.unitNumber,
          floor: row.floor,
          bedrooms: row.bedrooms,
          status: row.status,
          priceListedRs: Number(row.priceListedRs),
          priceFinalRs: row.priceFinalRs != null ? Number(row.priceFinalRs) : null,
          projectId: row.projectId,
          projectName: row.projectName,
          leadId: row.leadId,
          leadName: row.leadName?.trim() || "—",
          agentId: row.agentId,
          agentName: row.agentName?.trim() || "—",
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: Number(count),
      };
    },

    async getBookingPdfAccessContext(projectId: string, unitId: string) {
      const [unitRow] = await db
        .select({ leadAssignedTo: leads.assignedTo })
        .from(projectUnits)
        .leftJoin(leads, eq(projectUnits.assignedLeadId, leads.id))
        .where(and(eq(projectUnits.id, unitId), eq(projectUnits.projectId, projectId)))
        .limit(1);

      const doc = await this.getLatestForUnit(unitId);

      return {
        agentId: doc?.agentId ?? null,
        leadAssignedTo: unitRow?.leadAssignedTo ?? null,
      };
    },
  };
}

export type BookingDocumentService = ReturnType<typeof createBookingDocumentService>;
