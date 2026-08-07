import { Hono } from "hono";
import { z } from "zod";
import { AUDIT_ACTIONS } from "../lib/auditActions.js";
import { getClientIp } from "../lib/clientIp.js";
import { parseDocumentMultipart } from "../lib/multipartUpload.js";
import { listPaginationSchema } from "../lib/pagination.js";
import { canViewLead, forbiddenResponse, hasPermission, isAdmin } from "../lib/permissions.js";
import { SIGNED_URL_EXPIRY_SECONDS, isR2Configured } from "../lib/r2Storage.js";
import { assertDocumentOrgAccess } from "../lib/resourceScope.js";
import { jsonError, jsonOk } from "../lib/response.js";
import { validate } from "../lib/validate.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  documentUploadConcurrencyLimit,
  mapDocumentUploadError,
  rejectOversizedUploadByContentLength,
} from "../middleware/documentUpload.js";
import { documentUploadRateLimit } from "../middleware/rateLimit.js";
import { auditFromContext } from "../services/auditService.js";
import { documentService } from "../services/documentService.js";
import { leadService } from "../services/leadService.js";

export const documentsRoutes = new Hono();

const listDocumentsSchema = listPaginationSchema.extend({
  projectId: z.string().uuid().optional(),
  isGlobal: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  fileType: z.enum(["pdf", "image", "other"]).optional(),
  search: z.string().max(200).optional(),
});

const shareDocumentSchema = z.object({
  leadId: z.string().uuid(),
  sharedVia: z.enum(["whatsapp", "email", "link"]),
});

const updateDocumentSchema = z.object({
  isPublic: z.boolean().optional(),
  category: z.enum(["brochure", "floor_plan", "price_list", "other"]).nullable().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

function canManageDocuments(user: AuthUser) {
  return (
    isAdmin(user) || user.role === "manager" || hasPermission(user, "projects:update_documents")
  );
}

documentsRoutes.get("/", validate("query", listDocumentsSchema), async (c) => {
  const query = c.req.valid("query");
  const data = await documentService.list(query);
  return jsonOk(c, data);
});

documentsRoutes.post(
  "/upload",
  documentUploadRateLimit,
  documentUploadConcurrencyLimit,
  async (c) => {
    const authUser = c.get("authUser") as AuthUser;

    if (!canManageDocuments(authUser)) {
      return c.json(forbiddenResponse(), 403);
    }

    if (!isR2Configured()) {
      return jsonError(c, "STORAGE_NOT_CONFIGURED", "Document storage is not configured", 503);
    }

    const oversized = rejectOversizedUploadByContentLength(c);
    if (oversized) return oversized;

    try {
      const { fields, file } = await parseDocumentMultipart(c.req.raw);

      const name = fields.name?.trim() ?? "";
      if (!name) {
        return jsonError(c, "VALIDATION_ERROR", "Name is required", 400);
      }

      const description = fields.description?.trim() || null;
      const projectId = fields.projectId && fields.projectId.length > 0 ? fields.projectId : null;
      const isGlobal = fields.isGlobal === "true";
      const isPublic = fields.isPublic === "true";
      const rawCategory = fields.category?.trim() || "";
      const category =
        rawCategory === "brochure" ||
        rawCategory === "floor_plan" ||
        rawCategory === "price_list" ||
        rawCategory === "other"
          ? rawCategory
          : null;

      const doc = await documentService.upload({
        name,
        description,
        projectId,
        isGlobal,
        isPublic,
        category,
        uploadedBy: authUser.id,
        filename: file.filename,
        buffer: file.buffer,
      });

      await auditFromContext(c, c.get("db"), {
        userId: authUser.id,
        action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
        entityType: "document",
        entityId: doc.id,
        entityName: doc.name,
        metadata: {
          projectId,
          isGlobal,
          isPublic,
          category,
          filename: file.filename,
          originalName: file.filename,
          fileType: doc.fileType,
          fileSizeMb: doc.fileSizeMb,
        },
      });

      return jsonOk(c, doc, undefined, 201);
    } catch (error) {
      const mapped = mapDocumentUploadError(c, error);
      if (mapped) return mapped;
      throw error;
    }
  },
);

documentsRoutes.get("/:id/signed-url", async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const id = c.req.param("id");
  const doc = await documentService.getById(id);

  if (!doc) {
    return jsonError(c, "NOT_FOUND", "Document not found", 404);
  }

  assertDocumentOrgAccess(authUser, doc);

  const result = await documentService.getSignedUrl(id, getClientIp(c));

  if (!result) {
    return jsonError(c, "NOT_FOUND", "Document not found", 404);
  }

  return jsonOk(c, {
    signedUrl: result.signedUrl,
    expiresInSeconds: result.expiresInSeconds ?? SIGNED_URL_EXPIRY_SECONDS,
    document: result.document,
  });
});

documentsRoutes.post("/:id/share", validate("json", shareDocumentSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;
  const documentId = c.req.param("id");
  const payload = c.req.valid("json");

  const doc = await documentService.getById(documentId);
  if (!doc) {
    return jsonError(c, "NOT_FOUND", "Document not found", 404);
  }
  assertDocumentOrgAccess(authUser, doc);

  const lead = await leadService.getLeadById(payload.leadId);
  if (!lead) {
    return jsonError(c, "NOT_FOUND", "Lead not found", 404);
  }
  if (!canViewLead(authUser, { assignedTo: lead.assignedTo })) {
    return c.json(forbiddenResponse(), 403);
  }

  const share = await documentService.share({
    documentId,
    leadId: payload.leadId,
    sharedBy: authUser.id,
    sharedVia: payload.sharedVia,
  });

  if (!share) {
    return jsonError(c, "NOT_FOUND", "Document or lead not found", 404);
  }

  await auditFromContext(c, c.get("db"), {
    userId: authUser.id,
    action: AUDIT_ACTIONS.DOCUMENT_SHARED,
    entityType: "document",
    entityId: documentId,
    entityName: doc.name,
    metadata: {
      leadId: payload.leadId,
      sharedVia: payload.sharedVia,
    },
  });

  const apiBase = process.env.API_PUBLIC_URL?.replace(/\/$/, "") ?? new URL(c.req.url).origin;
  const viewUrl = `${apiBase}/api/documents/${documentId}/view?token=${share.shareToken}`;

  return jsonOk(c, { ...share, viewUrl }, undefined, 201);
});

documentsRoutes.patch("/:id", validate("json", updateDocumentSchema), async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!canManageDocuments(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }

  const id = c.req.param("id");
  const payload = c.req.valid("json");
  const existing = await documentService.getById(id);
  if (!existing) {
    return jsonError(c, "NOT_FOUND", "Document not found", 404);
  }
  assertDocumentOrgAccess(authUser, existing);

  const updated = await documentService.update(id, payload);
  if (!updated) {
    return jsonError(c, "NOT_FOUND", "Document not found", 404);
  }

  return jsonOk(c, updated);
});

documentsRoutes.delete("/:id", async (c) => {
  const authUser = c.get("authUser") as AuthUser;

  if (!canManageDocuments(authUser)) {
    return c.json(forbiddenResponse(), 403);
  }

  const deleted = await documentService.delete(c.req.param("id"));
  if (!deleted) {
    return jsonError(c, "NOT_FOUND", "Document not found", 404);
  }

  await auditFromContext(c, c.get("db"), {
    userId: authUser.id,
    action: AUDIT_ACTIONS.DOCUMENT_DELETED,
    entityType: "document",
    entityId: deleted.id,
    entityName: deleted.name,
  });

  return jsonOk(c, { id: deleted.id });
});

/** Public view tracking — mounted before auth middleware. */
export const documentViewRoutes = new Hono();

documentViewRoutes.get("/:id/view", async (c) => {
  const documentId = c.req.param("id");
  const token = c.req.query("token");

  if (!token) {
    return jsonError(c, "VALIDATION_ERROR", "Missing share token", 400);
  }

  const signedUrl = await documentService.trackView(documentId, token, getClientIp(c));
  if (!signedUrl) {
    return jsonError(c, "NOT_FOUND", "Share link not found or expired", 404);
  }

  return c.redirect(signedUrl, 302);
});
