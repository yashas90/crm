import { colors, radii } from "@/theme";
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
};

const labelColors: Record<ButtonVariant, string> = {
  primary: "#fff",
  secondary: colors.primaryLight,
  danger: "#fff",
  ghost: colors.textDark,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={labelColors[variant]} />
      ) : (
        <Text style={[styles.label, { color: labelColors[variant] }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
  },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: colors.cardDark, borderWidth: 1, borderColor: colors.borderDark },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: "700" },
});
