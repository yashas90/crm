import { createHash } from "node:crypto";
import { isValidIndianMobile } from "../indianPhone.js";
import { normalizeStoredPhone, phoneDigits } from "../leadPhone.js";

function stripControls(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    const isControl =
      code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
    if (!isControl) out += char;
  }
  return out;
}

export function sanitizeText(value: unknown, max = 200): string {
  if (value == null) return "";
  return stripControls(String(value)).replace(/\s+/g, " ").trim().slice(0, max);
}

export function phoneHash(phone: string): string {
  return createHash("sha256").update(phone).digest("hex");
}

export function normalizePoolPhone(value: unknown): string | null {
  const raw = sanitizeText(value, 32);
  if (!raw) return null;
  if (!isValidIndianMobile(raw)) return null;
  return normalizeStoredPhone(raw);
}

export function phoneLast10(phone: string): string {
  return phoneDigits(phone).slice(-10);
}

export type PropertyType = "apartment" | "villa" | "plot";

export function normalizePropertyType(value: unknown): PropertyType | null {
  const text = sanitizeText(value, 40).toLowerCase();
  if (!text) return null;
  if (text.includes("villa") || text === "independent house" || text === "house") return "villa";
  if (text.includes("plot") || text.includes("land")) return "plot";
  if (text.includes("apartment") || text.includes("flat") || text === "apt") return "apartment";
  return null;
}

export function normalizeBedrooms(value: unknown): string | null {
  const text = sanitizeText(value, 20).toUpperCase().replace(/\s+/g, "");
  if (!text) return null;
  const match = text.match(/^([1-5])(?:BHK|BR|BED|BEDROOM)?$/);
  if (match) return `${match[1]}BHK`;
  const embedded = text.match(/([1-5])\s*BHK/);
  if (embedded) return `${embedded[1]}BHK`;
  return null;
}

/** Parse 5000000, 50L, 1.2Cr, 50,00,000 into rupees. */
export function parseBudget(value: unknown): { amount: number | null; label: string | null } {
  const label = sanitizeText(value, 40);
  if (!label) return { amount: null, label: null };
  const compact = label.replace(/,/g, "").replace(/\s+/g, "").toLowerCase();
  const crore = compact.match(/^(\d+(?:\.\d+)?)cr$/);
  if (crore) return { amount: Math.round(Number(crore[1]) * 10_000_000), label };
  const lakh = compact.match(/^(\d+(?:\.\d+)?)l(?:akh)?$/);
  if (lakh) return { amount: Math.round(Number(lakh[1]) * 100_000), label };
  const digits = compact.replace(/[^\d.]/g, "");
  if (!digits) return { amount: null, label };
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount < 0) return { amount: null, label };
  return { amount: Math.round(amount), label };
}

export function splitPersonName(name: string): { firstName: string; lastName: string } {
  const parts = sanitizeText(name, 120).split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export const UPLOAD_CHUNK_SIZE = 500;
export const MAX_UPLOAD_ROWS = 20_000;

export function chunkRows<T>(rows: T[], size = UPLOAD_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}
