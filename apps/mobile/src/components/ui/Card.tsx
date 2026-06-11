import { colors, radii, spacing } from "@/theme";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Card({ children, onPress, style }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
        onPress={onPress}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  pressed: { opacity: 0.9 },
});
