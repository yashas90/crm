import { colors, radii, shadows } from "@/theme";
import type { ViewStyle } from "react-native";

export const proBorder = {
  borderWidth: 1,
  borderColor: colors.border,
} as const;

export const proCard: ViewStyle = {
  backgroundColor: colors.card,
  borderRadius: radii.md,
  ...proBorder,
  ...shadows.card,
};

export const proCardPressed: ViewStyle = {
  opacity: 0.96,
  transform: [{ scale: 0.99 }],
};

export const proSticky: ViewStyle = {
  backgroundColor: colors.sticky,
  borderRadius: radii.md,
  ...proBorder,
  ...shadows.cardSm,
};

export const proInput: ViewStyle = {
  backgroundColor: colors.card,
  borderRadius: radii.sm,
  ...proBorder,
  ...shadows.cardSm,
  paddingHorizontal: 16,
  paddingVertical: 14,
};

/** @deprecated Use proCard — kept for gradual migration */
export const neuCard = proCard;
export const neuCardPressed = proCardPressed;
export const neuSticky = proSticky;
export const neuInput = proInput;
export const neuBorder = proBorder;
