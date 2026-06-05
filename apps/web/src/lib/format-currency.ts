export function formatInrCompact(value: number) {
  const amount = Math.round(value);
  if (amount >= 10_000_000) {
    return `₹${(amount / 10_000_000).toFixed(1)} Cr+`;
  }
  if (amount >= 100_000) {
    return `₹${Math.round(amount / 100_000)} L+`;
  }
  if (amount >= 1_000) {
    return `₹${Math.round(amount / 1_000)} K+`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatInrFull(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseMoney(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}
