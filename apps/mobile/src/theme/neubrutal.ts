import { colors, radii, shadows } from "@/theme";
import type { ViewStyle } from "react-native";

export const neuBorder = {
  borderWidth: 2,
  borderColor: colors.border,
} as const;

export const neuCard: ViewStyle = {
  backgroundColor: colors.card,
  ...neuBorder,
  ...shadows.neu,
};

export const neuCardPressed: ViewStyle = {
  opacity: 0.92,
  transform: [{ translateX: 1 }, { translateY: 1 }],
};

export const neuSticky: ViewStyle = {
  backgroundColor: colors.sticky,
  ...neuBorder,
  ...shadows.neu,
};

export const neuInput: ViewStyle = {
  backgroundColor: colors.card,
  ...neuBorder,
  ...shadows.neuSm,
  borderRadius: radii.sm,
  paddingHorizontal: 16,
  paddingVertical: 14,
};
