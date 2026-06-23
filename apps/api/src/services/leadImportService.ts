import { leadImportBatchItems, leadImportBatches, leads, siteVisits, users } from "@propninja/db";
import { and, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { boundPageSize } from "../lib/pagination.js";

export type LeadImportBatchOutcome = "created" | "updated" | "skipped" | "failed";

export type LeadImportBatchReport = {
  created: { row: number; id: string; phone: string }[];
  updated: { row: number; id: string; phone: string }[];
  skipped: { row: number; phone: string; reason: string }[];
  failed: { row: number; message: string }[];
  parseErrors?: { row: number; message: string }[];
};

export type LeadImportBatchStats = {
  visitsBooked: number;
  hotCount: number;
  coldCount: number;
  droppedCount: number;
  notInterestedCount: number;
};

function mapBatchRow(row: {
  id: string;
  fileName: string | null;
  status: string;
  totalCount: number;
  uniqueCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  invalidCount: number;
  createdAt: Date;
  completedAt: Date | null;
  uploaderName: string | null;
  uploaderEmail: string | null;
}) {
  const totalUploaded = row.createdCount + row.updatedCount;
  return {
    id: row.id,
    fileName: row.fileName,
    status: row.status as "initiated" | "completed" | "failed",
    totalCount: row.totalCount,
    uniqueCount: row.uniqueCount,
    totalUploaded,
    duplicateCount: row.skippedCount,
    invalidCount: row.invalidCount + row.failedCount,
    createdCount: row.createdCount,
    updatedCount: row.updatedCount,
    skippedCount: row.skippedCount,
    failedCount: row.failedCount,
    uploadedBy: {
      name: row.uploaderName ?? "Unknown",
      email: row.uploaderEmail,
    },
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

async function fetchBatchLeadStats(batchIds: string[]): Promise<Map<string, LeadImportBatchStats>> {
  const stats = new Map<string, LeadImportBatchStats>();
  if (batchIds.length === 0) return stats;

  const leadStatsRows = await db
    .select({
      batchId: leadImportBatchItems.batchId,
      hotCount: sql<number>`count(*) filter (where ${leads.temperature} = 'hot')::int`,
      coldCount: sql<number>`count(*) filter (where ${leads.temperature} = 'cold')::int`,
      droppedCount: sql<number>`count(*) filter (where ${leads.leadStatus} = 'dropped')::int`,
      notInterestedCount: sql<number>`count(*) filter (where ${leads.leadStatus} = 'not_interested')::int`,
    })
    .from(leadImportBatchItems)
    .innerJoin(leads, eq(leadImportBatchItems.leadId, leads.id))
    .where(
      and(
        inArray(leadImportBatchItems.batchId, batchIds),
        inArray(leadImportBatchItems.outcome, ["created", "updated"]),
        isNull(leads.deletedAt),
      ),
    )
    .groupBy(leadImportBatchItems.batchId);

  const visitStatsRows = await db
    .select({
      batchId: leadImportBatchItems.batchId,
      visitsBooked: sql<number>`count(distinct ${siteVisits.id})::int`,
    })
    .from(leadImportBatchItems)
    .innerJoin(siteVisits, eq(leadImportBatchItems.leadId, siteVisits.leadId))
    .where(
      and(
        inArray(leadImportBatchItems.batchId, batchIds),
        inArray(leadImportBatchItems.outcome, ["created", "updated"]),
        ne(siteVisits.status, "cancelled"),
      ),
    )
    .groupBy(leadImportBatchItems.batchId);

  for (const batchId of batchIds) {
    stats.set(batchId, {
      visitsBooked: 0,
      hotCount: 0,
      coldCount: 0,
      droppedCount: 0,
      notInterestedCount: 0,
    });
  }

  for (const row of leadStatsRows) {
    const existing = stats.get(row.batchId)!;
    stats.set(row.batchId, {
      ...existing,
      hotCount: row.hotCount,
      coldCount: row.coldCount,
      droppedCount: row.droppedCount,
      notInterestedCount: row.notInterestedCount,
    });
  }

  for (const row of visitStatsRows) {
    const existing = stats.get(row.batchId)!;
    stats.set(row.batchId, { ...existing, visitsBooked: row.visitsBooked });
  }

  return stats;
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildImportReportCsv(
  batch: ReturnType<typeof mapBatchRow>,
  report: LeadImportBatchReport,
) {
  const lines = [
    [
      "Batch ID",
      batch.id,
      "File",
      batch.fileName ?? "",
      "Uploaded",
      batch.createdAt,
      "Uploader",
      batch.uploadedBy.name,
    ].join(","),
    "",
    "Row,Outcome,Phone,Lead ID,Message",
  ];

  for (const row of report.created) {
    lines.push([row.row, "created", escapeCsvCell(row.phone), row.id, ""].join(","));
  }
  for (const row of report.updated) {
    lines.push([row.row, "updated", escapeCsvCell(row.phone), row.id, ""].join(","));
  }
  for (const row of report.skipped) {
    lines.push(
      [row.row, "skipped", escapeCsvCell(row.phone), "", escapeCsvCell(row.reason)].join(","),
    );
  }
  for (const row of report.failed) {
    lines.push([row.row, "failed", "", "", escapeCsvCell(row.message)].join(","));
  }
  for (const row of report.parseErrors ?? []) {
    lines.push([row.row, "invalid", "", "", escapeCsvCell(row.message)].join(","));
  }

  return `${lines.join("\n")}\n`;
}

export const leadImportService = {
  async createBatch(input: {
    uploadedBy: string;
    fileName?: string | null;
    totalCount: number;
    uniqueCount: number;
    invalidCount?: number;
  }) {
    const [batch] = await db
      .insert(leadImportBatches)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        uploadedBy: input.uploadedBy,
        fileName: input.fileName ?? null,
        status: "initiated",
        totalCount: input.totalCount,
        uniqueCount: input.uniqueCount,
        invalidCount: input.invalidCount ?? 0,
      })
      .returning();

    return batch!;
  },

  async completeBatch(
    batchId: string,
    input: {
      createdCount: number;
      updatedCount: number;
      skippedCount: number;
      failedCount: number;
      invalidCount: number;
      report: LeadImportBatchReport;
    },
  ) {
    await db
      .update(leadImportBatches)
      .set({
        status: "completed",
        createdCount: input.createdCount,
        updatedCount: input.updatedCount,
        skippedCount: input.skippedCount,
        failedCount: input.failedCount,
        invalidCount: input.invalidCount,
        reportJson: input.report,
        completedAt: new Date(),
      })
      .where(
        and(eq(leadImportBatches.id, batchId), eq(leadImportBatches.orgId, SINGLE_TENANT_ORG_ID)),
      );
  },

  async failBatch(batchId: string, report?: LeadImportBatchReport) {
    await db
      .update(leadImportBatches)
      .set({
        status: "failed",
        reportJson: report ?? null,
        completedAt: new Date(),
      })
      .where(
        and(eq(leadImportBatches.id, batchId), eq(leadImportBatches.orgId, SINGLE_TENANT_ORG_ID)),
      );
  },

  async insertBatchItems(
    batchId: string,
    items: {
      rowNumber: number;
      outcome: LeadImportBatchOutcome;
      leadId?: string | null;
      phone?: string | null;
      message?: string | null;
    }[],
  ) {
    if (items.length === 0) return;

    await db.insert(leadImportBatchItems).values(
      items.map((item) => ({
        batchId,
        rowNumber: item.rowNumber,
        outcome: item.outcome,
        leadId: item.leadId ?? null,
        phone: item.phone ?? null,
        message: item.message ?? null,
      })),
    );
  },

  async listBatches(params: { page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = boundPageSize(params.pageSize ?? 10, 50);
    const offset = (page - 1) * pageSize;

    const where = eq(leadImportBatches.orgId, SINGLE_TENANT_ORG_ID);

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: leadImportBatches.id,
          fileName: leadImportBatches.fileName,
          status: leadImportBatches.status,
          totalCount: leadImportBatches.totalCount,
          uniqueCount: leadImportBatches.uniqueCount,
          createdCount: leadImportBatches.createdCount,
          updatedCount: leadImportBatches.updatedCount,
          skippedCount: leadImportBatches.skippedCount,
          failedCount: leadImportBatches.failedCount,
          invalidCount: leadImportBatches.invalidCount,
          createdAt: leadImportBatches.createdAt,
          completedAt: leadImportBatches.completedAt,
          uploaderName: users.name,
          uploaderEmail: users.email,
        })
        .from(leadImportBatches)
        .innerJoin(users, eq(leadImportBatches.uploadedBy, users.id))
        .where(where)
        .orderBy(desc(leadImportBatches.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(leadImportBatches).where(where),
    ]);

    const batchIds = rows.map((row) => row.id);
    const statsMap = await fetchBatchLeadStats(batchIds);

    return {
      items: rows.map((row) => {
        const batch = mapBatchRow(row);
        const stats = statsMap.get(row.id) ?? {
          visitsBooked: 0,
          hotCount: 0,
          coldCount: 0,
          droppedCount: 0,
          notInterestedCount: 0,
        };
        return { ...batch, ...stats };
      }),
      page,
      pageSize,
      total: Number(totalRow[0]?.total ?? 0),
    };
  },

  async getBatchReportCsv(batchId: string) {
    const [row] = await db
      .select({
        batch: leadImportBatches,
        uploaderName: users.name,
      })
      .from(leadImportBatches)
      .innerJoin(users, eq(leadImportBatches.uploadedBy, users.id))
      .where(
        and(eq(leadImportBatches.id, batchId), eq(leadImportBatches.orgId, SINGLE_TENANT_ORG_ID)),
      )
      .limit(1);

    if (!row) return null;

    const batch = mapBatchRow({
      id: row.batch.id,
      fileName: row.batch.fileName,
      status: row.batch.status,
      totalCount: row.batch.totalCount,
      uniqueCount: row.batch.uniqueCount,
      createdCount: row.batch.createdCount,
      updatedCount: row.batch.updatedCount,
      skippedCount: row.batch.skippedCount,
      failedCount: row.batch.failedCount,
      invalidCount: row.batch.invalidCount,
      createdAt: row.batch.createdAt,
      completedAt: row.batch.completedAt,
      uploaderName: row.uploaderName,
      uploaderEmail: null,
    });

    const report = (row.batch.reportJson ?? {
      created: [],
      updated: [],
      skipped: [],
      failed: [],
    }) as LeadImportBatchReport;

    const fileName = batch.fileName?.replace(/\.[^.]+$/, "") ?? "lead-import";
    return {
      fileName: `${fileName}-report.csv`,
      content: buildImportReportCsv(batch, report),
    };
  },
};
