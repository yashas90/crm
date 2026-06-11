import { colors, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this data. Check your connection and try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.danger} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="secondary" style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.backgroundDark,
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
  button: { marginTop: spacing.lg, minWidth: 160 },
});
