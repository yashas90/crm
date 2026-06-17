import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type AccessDeniedProps = {
  message?: string;
  onGoBack?: () => void;
};

export function AccessDenied({
  message = "You do not have permission to view this screen.",
  onGoBack,
}: AccessDeniedProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="lock-closed-outline" size={48} color={colors.textMutedDark} />
      <Text style={styles.title}>Access denied</Text>
      <Text style={styles.message}>{message}</Text>
      {onGoBack ? (
        <Button label="Go back" variant="secondary" onPress={onGoBack} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  title: { ...typography.subheading, color: colors.textDark, marginTop: spacing.md },
  message: {
    color: colors.textMutedDark,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 22,
    fontSize: 14,
  },
  button: { marginTop: spacing.lg, alignSelf: "stretch" },
});
