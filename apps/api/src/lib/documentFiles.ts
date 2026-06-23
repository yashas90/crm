import path from "node:path";
import { fileTypeFromBuffer } from "file-type";

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export type DocumentFileType = "pdf" | "image" | "other";

const MIME_TO_FILE_TYPE: Record<AllowedDocumentMimeType, DocumentFileType> = {
  "application/pdf": "pdf",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "other",
};

export class DocumentFileValidationError extends Error {
  constructor(
    message: string,
    public code: "FILE_TOO_LARGE" | "INVALID_FILE_TYPE",
  ) {
    super(message);
    this.name = "DocumentFileValidationError";
  }
}

export function inferFileType(mimeType: string): DocumentFileType {
  return MIME_TO_FILE_TYPE[mimeType as AllowedDocumentMimeType] ?? "other";
}

export function assertDocumentSize(sizeBytes: number): void {
  if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    throw new DocumentFileValidationError(
      "File too large. Maximum size is 25MB.",
      "FILE_TOO_LARGE",
    );
  }
}

/** Sniff MIME from buffer bytes — do not trust client-supplied Content-Type. */
export async function validateDocumentFileBuffer(
  buffer: Buffer,
): Promise<{ fileType: DocumentFileType; mimeType: AllowedDocumentMimeType }> {
  assertDocumentSize(buffer.length);

  const detected = await fileTypeFromBuffer(buffer);
  const mimeType = detected?.mime;

  if (!mimeType || !ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType as AllowedDocumentMimeType)) {
    throw new DocumentFileValidationError("File type not allowed", "INVALID_FILE_TYPE");
  }

  return {
    fileType: inferFileType(mimeType),
    mimeType: mimeType as AllowedDocumentMimeType,
  };
}

export function buildSafeFilename(originalName: string): string {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${crypto.randomUUID()}-${base || "document"}`;
}

export function buildDocumentFileKey(projectId: string | null, originalName: string): string {
  const folder = projectId ?? "global";
  const safeFilename = buildSafeFilename(originalName);
  return `documents/${folder}/${safeFilename}`;
}
