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
  ghost: colors.text,
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
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    ...shadows.neuSm,
  },
  primary: { backgroundColor: colors.hot },
  secondary: { backgroundColor: colors.card },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: colors.sticky },
  pressed: {
    transform: [{ translateX: 1 }, { translateY: 1 }],
    shadowOffset: { width: 1, height: 1 },
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
});
