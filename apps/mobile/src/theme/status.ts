import { colors } from "@/theme";

export function statusStyle(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    new: { bg: "rgba(59, 130, 246, 0.18)", text: "#60a5fa" },
    contacted: { bg: "rgba(20, 184, 166, 0.18)", text: colors.primaryLight },
    qualified: { bg: "rgba(99, 102, 241, 0.18)", text: "#a5b4fc" },
    negotiation: { bg: "rgba(245, 158, 11, 0.18)", text: "#fbbf24" },
    won: { bg: "rgba(16, 185, 129, 0.18)", text: "#34d399" },
    lost: { bg: "rgba(239, 68, 68, 0.18)", text: "#f87171" },
  };
  return map[status] ?? { bg: "rgba(148, 163, 184, 0.15)", text: colors.textMutedDark };
}

export function temperatureStyle(temp: string | null | undefined) {
  const map: Record<string, { bg: string; text: string }> = {
    hot: { bg: "rgba(239, 68, 68, 0.18)", text: "#f87171" },
    warm: { bg: "rgba(245, 158, 11, 0.18)", text: "#fbbf24" },
    cold: { bg: "rgba(59, 130, 246, 0.18)", text: "#60a5fa" },
  };
  if (!temp) return null;
  return map[temp] ?? { bg: "rgba(148, 163, 184, 0.15)", text: colors.textMutedDark };
}

export function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
