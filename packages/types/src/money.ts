/** Indian Rupee display. Grouping is lakhs and crores (en-IN), never 100,000. */
export function formatINR(amount: number | string | null | undefined): string {
  const parsed = typeof amount === "number" ? amount : Number(amount ?? 0);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return safe.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

/** Digits with Indian commas and no currency symbol. For inputs that show a ₹ prefix. */
export function formatINRDigits(amount: number | string | null | undefined): string {
  const parsed =
    typeof amount === "number" ? amount : Number(String(amount ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(parsed)) return "";
  return Math.round(parsed).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/**
 * Accepts 500000, 5,00,000, and ₹5,00,000. Returns a whole-rupee integer.
 * Empty input is undefined so the field can be cleared.
 */
export function parseINR(input: string | number | null | undefined): number | undefined {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input) : undefined;
  }
  if (input == null) return undefined;
  const cleaned = input.replace(/[₹,\s]/g, "").trim();
  if (!cleaned) return undefined;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed);
}
