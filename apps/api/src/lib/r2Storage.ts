import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env.js";

/** Signed download links expire after one hour. */
export const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

function r2Endpoint() {
  return `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials are not configured");
    }
    client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint(),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return client;
}

export function isR2Configured(): boolean {
  return Boolean(
    env.CLOUDFLARE_R2_ACCOUNT_ID &&
      env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      env.CLOUDFLARE_R2_BUCKET_NAME &&
      env.CLOUDFLARE_R2_PUBLIC_URL,
  );
}

/** Public CDN URL — never exposes bucket name or account ID. */
export function publicFileUrl(fileKey: string): string {
  const base = (env.CLOUDFLARE_R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  return `${base}/${fileKey}`;
}

export async function uploadToR2(
  fileKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: fileKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteFromR2(fileKey: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: fileKey,
    }),
  );
}

function sanitizeDownloadFilename(filename: string): string {
  return filename.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "download";
}

export type SignedDownloadOptions = {
  expiresInSeconds?: number;
  /** When true, PDFs are served with Content-Disposition: attachment. */
  forceAttachment?: boolean;
  downloadFilename?: string;
  mimeType?: string;
};

export async function createSignedDownloadUrl(
  fileKey: string,
  options: SignedDownloadOptions = {},
): Promise<string> {
  const expiresIn = options.expiresInSeconds ?? SIGNED_URL_EXPIRY_SECONDS;
  const isPdf =
    options.mimeType === "application/pdf" ||
    fileKey.toLowerCase().endsWith(".pdf") ||
    options.forceAttachment;

  const commandParams: ConstructorParameters<typeof GetObjectCommand>[0] = {
    Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: fileKey,
  };

  if (isPdf) {
    const name = sanitizeDownloadFilename(options.downloadFilename ?? "document.pdf");
    commandParams.ResponseContentDisposition = `attachment; filename="${name}"`;
    commandParams.ResponseContentType = "application/pdf";
  }

  const command = new GetObjectCommand(commandParams);
  return getSignedUrl(getClient(), command, { expiresIn });
}
