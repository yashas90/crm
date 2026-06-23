import { hapticLight } from "@/lib/haptics";
import { colors, radii, shadows } from "@/theme";
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
  primary: "#ffffff",
  secondary: colors.text,
  danger: "#ffffff",
  ghost: colors.primary,
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
      onPress={() => {
        if (!isDisabled) hapticLight();
        onPress();
      }}
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
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    ...shadows.cardSm,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: "600" },
});
