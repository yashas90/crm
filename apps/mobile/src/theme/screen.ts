import { colors, shadows, spacing, typography } from "@/theme";
import { neuCard, neuSticky } from "@/theme/neubrutal";
import { StyleSheet } from "react-native";

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: spacing.sm,
    ...neuCard,
  },
  statValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...neuCard,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    ...neuSticky,
  },
});
