import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  buildDocumentFileKey,
  buildSafeFilename,
  inferFileType,
  validateDocumentFileBuffer,
} from "./documentFiles.js";

const PDF_BUFFER = Buffer.from("%PDF-1.4\n1 0 obj\n");

describe("validateDocumentFileBuffer", () => {
  it("accepts PDF content detected by magic bytes", async () => {
    const result = await validateDocumentFileBuffer(PDF_BUFFER);
    expect(result.fileType).toBe("pdf");
    expect(result.mimeType).toBe("application/pdf");
  });

  it("rejects oversized files", async () => {
    const huge = Buffer.alloc(MAX_DOCUMENT_SIZE_BYTES + 1);
    await expect(validateDocumentFileBuffer(huge)).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
    });
  });

  it("rejects disallowed content regardless of filename", async () => {
    const exeLike = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    await expect(validateDocumentFileBuffer(exeLike)).rejects.toMatchObject({
      code: "INVALID_FILE_TYPE",
      message: "File type not allowed",
    });
  });
});

describe("inferFileType", () => {
  it("maps images, pdf, and video", () => {
    expect(inferFileType("image/png")).toBe("image");
    expect(inferFileType("image/webp")).toBe("image");
    expect(inferFileType("application/pdf")).toBe("pdf");
    expect(inferFileType("video/mp4")).toBe("other");
  });
});

describe("buildSafeFilename", () => {
  it("sanitises unsafe characters", () => {
    const name = buildSafeFilename("../../evil name (1).pdf");
    expect(name).toMatch(/^[0-9a-f-]{36}-evil_name__1_\.pdf$/i);
  });
});

describe("buildDocumentFileKey", () => {
  it("uses global folder when project is null", () => {
    const key = buildDocumentFileKey(null, "brochure.pdf");
    expect(key.startsWith("documents/global/")).toBe(true);
    expect(key.endsWith("-brochure.pdf")).toBe(true);
  });
});
