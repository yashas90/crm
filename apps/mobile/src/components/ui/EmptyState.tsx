import { colors, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon = "folder-open-outline",
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={48} color={colors.textMutedDark} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.subheading,
    color: colors.textDark,
    marginTop: spacing.md,
    textAlign: "center",
  },
  message: {
    color: colors.textMutedDark,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 22,
    fontSize: 14,
  },
  button: { marginTop: spacing.md, alignSelf: "stretch" },
});
