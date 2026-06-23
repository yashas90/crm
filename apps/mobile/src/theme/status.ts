import { colors } from "@/theme";

export function statusStyle(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    new: { bg: "#dbeafe", text: "#1a3550" },
    contacted: { bg: "#fef08a", text: "#000000" },
    qualified: { bg: "#bfdbfe", text: "#1e40af" },
    negotiation: { bg: "#fde68a", text: "#92400e" },
    won: { bg: "#bbf7d0", text: "#166534" },
    lost: { bg: "#fecaca", text: "#991b1b" },
  };
  return map[status] ?? { bg: colors.card, text: colors.textMuted };
}

export function temperatureStyle(temp: string | null | undefined) {
  const map: Record<string, { bg: string; text: string }> = {
    hot: { bg: colors.hot, text: "#ffffff" },
    warm: { bg: "#fde68a", text: "#92400e" },
    cold: { bg: "#dbeafe", text: "#1a3550" },
  };
  if (!temp) return null;
  return map[temp] ?? { bg: colors.card, text: colors.textMuted };
}

export function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
