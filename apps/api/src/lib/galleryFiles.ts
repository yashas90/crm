import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { publicFileUrl, uploadToR2 } from "./r2Storage.js";

export const MAX_GALLERY_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_GALLERY_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type GalleryMimeType = (typeof ALLOWED_GALLERY_MIME_TYPES)[number];

export class GalleryFileValidationError extends Error {
  constructor(
    message: string,
    public code: "FILE_TOO_LARGE" | "INVALID_FILE_TYPE",
  ) {
    super(message);
    this.name = "GalleryFileValidationError";
  }
}

export async function validateGalleryImageBuffer(
  buffer: Buffer,
): Promise<{ mimeType: GalleryMimeType }> {
  if (buffer.length > MAX_GALLERY_IMAGE_BYTES) {
    throw new GalleryFileValidationError(
      "Image too large. Maximum size is 10MB.",
      "FILE_TOO_LARGE",
    );
  }

  const detected = await fileTypeFromBuffer(buffer);
  const mimeType = detected?.mime;
  if (!mimeType || !ALLOWED_GALLERY_MIME_TYPES.includes(mimeType as GalleryMimeType)) {
    throw new GalleryFileValidationError(
      "Only JPEG, PNG, and WebP images are allowed",
      "INVALID_FILE_TYPE",
    );
  }

  return { mimeType: mimeType as GalleryMimeType };
}

function safeFilename(originalName: string): string {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${randomUUID()}-${base || "image"}`;
}

export function buildGalleryFileKey(projectId: string, originalName: string): string {
  return `gallery/${projectId}/${safeFilename(originalName)}`;
}

export async function uploadGalleryImage(
  projectId: string,
  originalName: string,
  buffer: Buffer,
): Promise<{ fileKey: string; url: string; mimeType: GalleryMimeType; name: string }> {
  const { mimeType } = await validateGalleryImageBuffer(buffer);
  const fileKey = buildGalleryFileKey(projectId, originalName);
  await uploadToR2(fileKey, buffer, mimeType);
  const name = path.basename(originalName) || "image";
  return {
    fileKey,
    url: publicFileUrl(fileKey),
    mimeType,
    name,
  };
}

export function galleryItemId(fileKey: string): string {
  return createHash("sha256").update(fileKey).digest("hex").slice(0, 16);
}
