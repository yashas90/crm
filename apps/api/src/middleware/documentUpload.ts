import type { Context, Next } from "hono";
import { DocumentFileValidationError, MAX_DOCUMENT_SIZE_BYTES } from "../lib/documentFiles.js";
import { acquireUploadSlot, releaseUploadSlot } from "../lib/documentUploadConcurrency.js";
import { MultipartFileTooLargeError, MultipartValidationError } from "../lib/multipartUpload.js";
import { jsonError } from "../lib/response.js";
import type { AuthUser } from "./auth.js";

export async function documentUploadConcurrencyLimit(c: Context, next: Next) {
  const authUser = c.get("authUser") as AuthUser;
  if (!acquireUploadSlot(authUser.id)) {
    return jsonError(
      c,
      "TOO_MANY_UPLOADS",
      "Too many simultaneous uploads. Maximum is 5 at a time.",
      429,
    );
  }

  try {
    await next();
  } finally {
    releaseUploadSlot(authUser.id);
  }
}

export function rejectOversizedUploadByContentLength(c: Context): Response | null {
  const contentLength = c.req.header("content-length");
  if (!contentLength) return null;

  const size = Number.parseInt(contentLength, 10);
  if (!Number.isFinite(size)) return null;

  if (size > MAX_DOCUMENT_SIZE_BYTES) {
    return jsonError(c, "FILE_TOO_LARGE", "File too large. Maximum size is 25MB.", 413);
  }

  return null;
}

export function mapDocumentUploadError(c: Context, error: unknown): Response | null {
  if (error instanceof DocumentFileValidationError) {
    if (error.code === "FILE_TOO_LARGE") {
      return jsonError(c, error.code, error.message, 413);
    }
    return jsonError(c, error.code, error.message, 400);
  }

  if (error instanceof MultipartFileTooLargeError) {
    return jsonError(c, "FILE_TOO_LARGE", error.message, 413);
  }
  if (error instanceof MultipartValidationError) {
    return jsonError(c, "VALIDATION_ERROR", error.message, 400);
  }

  return null;
}
