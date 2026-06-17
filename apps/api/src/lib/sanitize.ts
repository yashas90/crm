const HTML_TAG_PATTERN = /<[^>]*>/g;

/** Remove HTML tags from user-provided text fields. */
export function stripHtmlTags(value: string): string {
  return value.replace(HTML_TAG_PATTERN, "").trim();
}

/** Phone may contain spaces/dashes only; reject letters or other symbols. */
export function isNumericPhone(phone: string): boolean {
  const compact = phone.replace(/[\s\-().+]/g, "");
  return compact.length >= 5 && /^\d+$/.test(compact);
}

const LEAD_IMPORT_TEXT_FIELDS = new Set([
  "firstName",
  "lastName",
  "notes",
  "city",
  "state",
  "projectName",
  "leadSource",
  "address",
]);

/** Normalise a CSV import row before Zod validation. */
export function sanitizeLeadImportRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };

  for (const key of LEAD_IMPORT_TEXT_FIELDS) {
    const value = out[key];
    if (typeof value === "string") {
      out[key] = stripHtmlTags(value);
    }
  }

  if (typeof out.phone === "string") {
    out.phone = out.phone.trim();
  }

  return out;
}
