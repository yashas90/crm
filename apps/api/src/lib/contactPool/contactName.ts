import { headerValue } from "./parseSpreadsheet.js";
import { sanitizeText } from "./sanitize.js";

const FULL_NAME_KEYS = [
  "name",
  "full_name",
  "fullname",
  "contact_name",
  "customer_name",
  "client_name",
  "lead_name",
  "person_name",
];

const FIRST_NAME_KEYS = ["first_name", "firstname", "given_name", "fname"];
const LAST_NAME_KEYS = ["last_name", "lastname", "surname", "lname", "family_name"];

function usableName(value: string): string {
  const text = sanitizeText(value, 80);
  if (!text || text.toLowerCase() === "unknown") return "";
  return text;
}

/** Prefer a full-name column, then first + last. "Unknown" only when both are empty. */
export function contactNameFromRow(row: Record<string, string>): string {
  const direct = usableName(headerValue(row, FULL_NAME_KEYS));
  if (direct) return direct.slice(0, 120);
  const combined = [
    usableName(headerValue(row, FIRST_NAME_KEYS)),
    usableName(headerValue(row, LAST_NAME_KEYS)),
  ]
    .filter(Boolean)
    .join(" ");
  return combined.slice(0, 120) || "Unknown";
}

export function isMissingContactName(name: string | null | undefined): boolean {
  const text = sanitizeText(name, 120);
  return !text || text.toLowerCase() === "unknown";
}
