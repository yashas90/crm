import { Readable } from "node:stream";
import Busboy from "busboy";
import { MAX_DOCUMENT_SIZE_BYTES } from "./documentFiles.js";

export class MultipartFileTooLargeError extends Error {
  constructor() {
    super("File too large. Maximum size is 25MB.");
    this.name = "MultipartFileTooLargeError";
  }
}

export class MultipartValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MultipartValidationError";
  }
}

export type ParsedDocumentUpload = {
  fields: Record<string, string>;
  file: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
};

export async function parseDocumentMultipart(
  req: Request,
  maxFileSize = MAX_DOCUMENT_SIZE_BYTES,
): Promise<ParsedDocumentUpload> {
  const contentType = req.headers.get("content-type");
  if (!contentType?.toLowerCase().includes("multipart/form-data")) {
    throw new MultipartValidationError("Expected multipart form data");
  }

  if (!req.body) {
    throw new MultipartValidationError("Empty request body");
  }

  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    let fileData: ParsedDocumentUpload["file"] | null = null;
    let fileTooLarge = false;

    const bb = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: maxFileSize },
    });

    bb.on("file", (fieldname, stream, info) => {
      if (fieldname !== "file") {
        stream.resume();
        return;
      }

      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("limit", () => {
        fileTooLarge = true;
        reject(new MultipartFileTooLargeError());
      });
      stream.on("end", () => {
        if (!fileTooLarge) {
          fileData = {
            buffer: Buffer.concat(chunks),
            filename: info.filename,
            mimeType: info.mimeType,
          };
        }
      });
    });

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("error", reject);
    bb.on("finish", () => {
      if (fileTooLarge) return;
      if (!fileData) {
        reject(new MultipartValidationError("File is required"));
        return;
      }
      resolve({ fields, file: fileData });
    });

    Readable.fromWeb(req.body as ReadableStream<Uint8Array>).pipe(bb);
  });
}
