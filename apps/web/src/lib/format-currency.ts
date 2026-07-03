import { DEFAULT_ORG_CURRENCY, DEFAULT_ORG_LOCALE } from "@/lib/org-settings";

export function formatMoneyCompact(
  value: number,
  options?: { locale?: string; currency?: string },
) {
  const locale = options?.locale ?? DEFAULT_ORG_LOCALE;
  const currency = options?.currency ?? DEFAULT_ORG_CURRENCY;
  const amount = Math.round(value);

  if (currency === "INR") {
    if (amount >= 10_000_000) {
      return `₹${(amount / 10_000_000).toFixed(1)} Cr+`;
    }
    if (amount >= 100_000) {
      return `₹${Math.round(amount / 100_000)} L+`;
    }
    if (amount >= 1_000) {
      return `₹${Math.round(amount / 1_000)} K+`;
    }
    return `₹${amount.toLocaleString(locale)}`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: amount >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMoneyFull(value: number, options?: { locale?: string; currency?: string }) {
  const locale = options?.locale ?? DEFAULT_ORG_LOCALE;
  const currency = options?.currency ?? DEFAULT_ORG_CURRENCY;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** @deprecated Use formatMoneyCompact */
export function formatInrCompact(value: number) {
  return formatMoneyCompact(value, { locale: DEFAULT_ORG_LOCALE, currency: "INR" });
}

/** @deprecated Use formatMoneyFull */
export function formatInrFull(value: number) {
  return formatMoneyFull(value, { locale: DEFAULT_ORG_LOCALE, currency: "INR" });
}

export function parseMoney(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}
