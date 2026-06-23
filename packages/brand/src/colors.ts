/** PropNinja logo palette — sampled from official brand assets */
export const brand = {
  navy: "#204060",
  navyDark: "#1a3550",
  navyLight: "#406080",
  red: "#C02020",
  redDark: "#9a1818",
  cream: "#FFFBF2",
  sticky: "#FEF08A",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export type BrandColor = (typeof brand)[keyof typeof brand];
