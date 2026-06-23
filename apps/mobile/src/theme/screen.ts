import { colors, shadows, spacing, typography } from "@/theme";
import { proCard, proSticky } from "@/theme/neubrutal";
import { StyleSheet } from "react-native";

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    ...proCard,
  },
  statValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "500",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...proCard,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    ...proSticky,
  },
});
