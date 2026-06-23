import {
  documentAccessEvents,
  documents,
  leadDocumentShares,
  leads,
  projects,
  users,
} from "@propninja/db";
import { and, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import {
  type DocumentFileType,
  buildDocumentFileKey,
  validateDocumentFileBuffer,
} from "../lib/documentFiles.js";
import { boundPageSize } from "../lib/pagination.js";
import {
  SIGNED_URL_EXPIRY_SECONDS,
  createSignedDownloadUrl,
  deleteFromR2,
  publicFileUrl,
  uploadToR2,
} from "../lib/r2Storage.js";
import { SECURITY_ALERT_TYPES, createSecurityAlert } from "./securityAlertService.js";

export type SharedVia = "whatsapp" | "email" | "link";

export interface ListDocumentsParams {
  projectId?: string;
  isGlobal?: boolean;
  fileType?: DocumentFileType;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UploadDocumentInput {
  name: string;
  description?: string | null;
  projectId?: string | null;
  isGlobal?: boolean;
  uploadedBy: string;
  filename: string;
  buffer: Buffer;
}

export interface ShareDocumentInput {
  documentId: string;
  leadId: string;
  sharedBy: string;
  sharedVia: SharedVia;
}

const documentSelect = {
  id: documents.id,
  orgId: documents.orgId,
  name: documents.name,
  description: documents.description,
  fileKey: documents.fileKey,
  fileUrl: documents.fileUrl,
  originalName: documents.originalName,
  fileType: documents.fileType,
  fileSizeMb: documents.fileSizeMb,
  downloadCount: documents.downloadCount,
  projectId: documents.projectId,
  uploadedBy: documents.uploadedBy,
  isGlobal: documents.isGlobal,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
  project: {
    id: projects.id,
    name: projects.name,
  },
  uploader: {
    id: users.id,
    name: users.name,
  },
};

type DocumentRow = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  fileKey: string;
  fileUrl: string;
  originalName: string | null;
  fileType: string;
  fileSizeMb: string;
  downloadCount: number;
  projectId: string | null;
  uploadedBy: string;
  isGlobal: boolean;
  createdAt: Date;
  updatedAt: Date;
  project: { id: string; name: string } | null;
  uploader: { id: string; name: string } | null;
};

function mapDocument(row: DocumentRow) {
  return {
    ...row,
    fileType: row.fileType as DocumentFileType,
    fileSizeMb: Number(row.fileSizeMb),
  };
}

/** Strip internal storage paths from API responses. */
export function toPublicDocument(row: ReturnType<typeof mapDocument>) {
  const { fileKey, orgId, ...publicFields } = row;
  return publicFields;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const HIGH_ACCESS_THRESHOLD = 50;

async function recordDocumentAccess(documentId: string, ipAddress?: string | null) {
  await db.insert(documentAccessEvents).values({ documentId });

  await db
    .update(documents)
    .set({ downloadCount: sql`${documents.downloadCount} + 1` })
    .where(eq(documents.id, documentId));

  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
  const [accessRow] = await db
    .select({ total: count() })
    .from(documentAccessEvents)
    .where(
      and(
        eq(documentAccessEvents.documentId, documentId),
        gte(documentAccessEvents.accessedAt, oneHourAgo),
      ),
    );

  const hourlyAccessCount = accessRow?.total ?? 0;
  if (hourlyAccessCount === HIGH_ACCESS_THRESHOLD + 1) {
    const doc = await documentService.getById(documentId);
    await createSecurityAlert(db, {
      alertType: SECURITY_ALERT_TYPES.DOCUMENT_HIGH_ACCESS,
      details: {
        documentId,
        documentName: doc?.name ?? null,
        hourlyAccessCount,
        message: "Document accessed more than 50 times in one hour — possible external sharing",
      },
      ipAddress: ipAddress ?? null,
    });
  }
}

function signedUrlOptionsForDocument(doc: ReturnType<typeof mapDocument>) {
  const mimeType =
    doc.fileType === "pdf"
      ? "application/pdf"
      : doc.fileType === "image"
        ? "image/jpeg"
        : "application/octet-stream";

  return {
    expiresInSeconds: SIGNED_URL_EXPIRY_SECONDS,
    mimeType,
    forceAttachment: doc.fileType === "pdf",
    downloadFilename: doc.originalName ?? doc.name,
  };
}

export const documentService = {
  async list(params: ListDocumentsParams = {}) {
    const page = params.page ?? 1;
    const pageSize = boundPageSize(params.pageSize);
    const offset = (page - 1) * pageSize;

    const conditions = [eq(documents.orgId, SINGLE_TENANT_ORG_ID)];

    if (params.projectId) {
      conditions.push(eq(documents.projectId, params.projectId));
    }
    if (params.isGlobal === true) {
      conditions.push(eq(documents.isGlobal, true));
    }
    if (params.fileType) {
      conditions.push(eq(documents.fileType, params.fileType));
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      conditions.push(or(ilike(documents.name, term), ilike(documents.description, term))!);
    }

    const where = and(...conditions);

    const [rows, countRows] = await Promise.all([
      db
        .select(documentSelect)
        .from(documents)
        .leftJoin(projects, eq(documents.projectId, projects.id))
        .leftJoin(users, eq(documents.uploadedBy, users.id))
        .where(where)
        .orderBy(desc(documents.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(documents).where(where),
    ]);

    return {
      items: rows.map((row) => toPublicDocument(mapDocument(row))),
      total: countRows[0]?.total ?? 0,
      page,
      pageSize,
    };
  },

  async adminList(params: { page?: number; pageSize?: number } = {}) {
    const page = params.page ?? 1;
    const pageSize = boundPageSize(params.pageSize);
    const offset = (page - 1) * pageSize;
    const where = eq(documents.orgId, SINGLE_TENANT_ORG_ID);

    const [rows, countRows] = await Promise.all([
      db
        .select(documentSelect)
        .from(documents)
        .leftJoin(projects, eq(documents.projectId, projects.id))
        .leftJoin(users, eq(documents.uploadedBy, users.id))
        .where(where)
        .orderBy(desc(documents.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(documents).where(where),
    ]);

    return {
      items: rows.map((row) => toPublicDocument(mapDocument(row))),
      total: countRows[0]?.total ?? 0,
      page,
      pageSize,
    };
  },

  async getById(id: string) {
    const [row] = await db
      .select(documentSelect)
      .from(documents)
      .leftJoin(projects, eq(documents.projectId, projects.id))
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(and(eq(documents.id, id), eq(documents.orgId, SINGLE_TENANT_ORG_ID)))
      .limit(1);

    return row ? mapDocument(row) : null;
  },

  async upload(input: UploadDocumentInput) {
    const { fileType, mimeType } = await validateDocumentFileBuffer(input.buffer);
    const originalName = input.filename;
    const fileKey = buildDocumentFileKey(input.projectId ?? null, originalName);

    await uploadToR2(fileKey, input.buffer, mimeType);

    const fileUrl = publicFileUrl(fileKey);
    const fileSizeMb = (input.buffer.length / (1024 * 1024)).toFixed(3);

    const [created] = await db
      .insert(documents)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        fileKey,
        fileUrl,
        originalName,
        fileType,
        fileSizeMb,
        projectId: input.projectId ?? null,
        uploadedBy: input.uploadedBy,
        isGlobal: input.isGlobal ?? false,
      })
      .returning();

    const doc = await this.getById(created.id);
    if (!doc) throw new Error("Failed to load uploaded document");
    return toPublicDocument(doc);
  },

  async delete(id: string) {
    const doc = await this.getById(id);
    if (!doc) return null;

    await deleteFromR2(doc.fileKey);
    await db.delete(documents).where(eq(documents.id, id));
    return toPublicDocument(doc);
  },

  async getSignedUrl(documentId: string, ipAddress?: string | null) {
    const doc = await this.getById(documentId);
    if (!doc) return null;

    const signedUrl = await createSignedDownloadUrl(doc.fileKey, signedUrlOptionsForDocument(doc));
    await recordDocumentAccess(documentId, ipAddress);

    return {
      signedUrl,
      document: toPublicDocument(doc),
      expiresInSeconds: SIGNED_URL_EXPIRY_SECONDS,
    };
  },

  async share(input: ShareDocumentInput) {
    const doc = await this.getById(input.documentId);
    if (!doc) return null;

    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, input.leadId), eq(leads.orgId, SINGLE_TENANT_ORG_ID)))
      .limit(1);

    if (!lead) return null;

    const shareToken = crypto.randomUUID();

    const [share] = await db
      .insert(leadDocumentShares)
      .values({
        orgId: SINGLE_TENANT_ORG_ID,
        leadId: input.leadId,
        documentId: input.documentId,
        sharedBy: input.sharedBy,
        sharedVia: input.sharedVia,
        shareToken,
      })
      .returning();

    const enriched = await this.getShareById(share.id);
    return enriched;
  },

  async getShareById(id: string) {
    const [row] = await db
      .select({
        id: leadDocumentShares.id,
        leadId: leadDocumentShares.leadId,
        documentId: leadDocumentShares.documentId,
        sharedBy: leadDocumentShares.sharedBy,
        sharedVia: leadDocumentShares.sharedVia,
        shareToken: leadDocumentShares.shareToken,
        sharedAt: leadDocumentShares.sharedAt,
        viewedAt: leadDocumentShares.viewedAt,
        document: {
          id: documents.id,
          name: documents.name,
          fileType: documents.fileType,
          fileUrl: documents.fileUrl,
          fileSizeMb: documents.fileSizeMb,
        },
        sharer: {
          id: users.id,
          name: users.name,
        },
        lead: {
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
          phone: leads.phone,
        },
      })
      .from(leadDocumentShares)
      .innerJoin(documents, eq(leadDocumentShares.documentId, documents.id))
      .innerJoin(users, eq(leadDocumentShares.sharedBy, users.id))
      .innerJoin(leads, eq(leadDocumentShares.leadId, leads.id))
      .where(and(eq(leadDocumentShares.id, id), eq(leadDocumentShares.orgId, SINGLE_TENANT_ORG_ID)))
      .limit(1);

    if (!row) return null;

    return {
      ...row,
      sharedVia: row.sharedVia as SharedVia,
      document: {
        ...row.document,
        fileType: row.document.fileType as DocumentFileType,
        fileSizeMb: Number(row.document.fileSizeMb),
      },
    };
  },

  async listLeadDocuments(leadId: string) {
    const rows = await db
      .select({
        id: leadDocumentShares.id,
        leadId: leadDocumentShares.leadId,
        documentId: leadDocumentShares.documentId,
        sharedBy: leadDocumentShares.sharedBy,
        sharedVia: leadDocumentShares.sharedVia,
        shareToken: leadDocumentShares.shareToken,
        sharedAt: leadDocumentShares.sharedAt,
        viewedAt: leadDocumentShares.viewedAt,
        document: {
          id: documents.id,
          name: documents.name,
          description: documents.description,
          fileType: documents.fileType,
          fileUrl: documents.fileUrl,
          fileSizeMb: documents.fileSizeMb,
          projectId: documents.projectId,
        },
        sharer: {
          id: users.id,
          name: users.name,
        },
      })
      .from(leadDocumentShares)
      .innerJoin(documents, eq(leadDocumentShares.documentId, documents.id))
      .innerJoin(users, eq(leadDocumentShares.sharedBy, users.id))
      .where(
        and(
          eq(leadDocumentShares.leadId, leadId),
          eq(leadDocumentShares.orgId, SINGLE_TENANT_ORG_ID),
        ),
      )
      .orderBy(desc(leadDocumentShares.sharedAt));

    return rows.map((row) => ({
      ...row,
      sharedVia: row.sharedVia as SharedVia,
      document: {
        ...row.document,
        fileType: row.document.fileType as DocumentFileType,
        fileSizeMb: Number(row.document.fileSizeMb),
      },
    }));
  },

  async trackView(documentId: string, shareToken: string, ipAddress?: string | null) {
    const [share] = await db
      .select({
        id: leadDocumentShares.id,
        documentId: leadDocumentShares.documentId,
        fileKey: documents.fileKey,
        fileType: documents.fileType,
        viewedAt: leadDocumentShares.viewedAt,
      })
      .from(leadDocumentShares)
      .innerJoin(documents, eq(leadDocumentShares.documentId, documents.id))
      .where(
        and(
          eq(leadDocumentShares.documentId, documentId),
          eq(leadDocumentShares.shareToken, shareToken),
          eq(leadDocumentShares.orgId, SINGLE_TENANT_ORG_ID),
        ),
      )
      .limit(1);

    if (!share) return null;

    if (!share.viewedAt) {
      await db
        .update(leadDocumentShares)
        .set({ viewedAt: new Date() })
        .where(eq(leadDocumentShares.id, share.id));
    }

    const doc = await this.getById(documentId);
    if (!doc) return null;

    const signedUrl = await createSignedDownloadUrl(doc.fileKey, signedUrlOptionsForDocument(doc));
    await recordDocumentAccess(documentId, ipAddress);
    return signedUrl;
  },
};
