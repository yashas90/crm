import { randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^SV-\d{4}-[A-Z0-9]{8}$/;

/** Human-readable public reference, e.g. SV-2026-A3F29B1C */
export function generateSiteVisitPublicToken(now = new Date()): string {
  const year = now.getFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `SV-${year}-${suffix}`;
}

export function isValidSiteVisitPublicToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}
