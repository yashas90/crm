import { colors, radii, spacing } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type QueryErrorBannerProps = {
  message?: string;
  onRetry?: () => void;
};

export function QueryErrorBanner({
  message = "Couldn't refresh. Showing your last loaded data.",
  onRetry,
}: QueryErrorBannerProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.danger} />
      <Text style={styles.text}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  text: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  retry: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
