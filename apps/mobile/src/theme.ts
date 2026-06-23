export const colors = {
  primary: "#204060",
  primaryLight: "#204060",
  primaryDark: "#1a3550",
  accent: "#C02020",
  background: "#FFFBF2",
  backgroundDark: "#FFFBF2",
  card: "#ffffff",
  cardDark: "#ffffff",
  text: "#000000",
  textMuted: "#525252",
  textDark: "#000000",
  textMutedDark: "#525252",
  border: "#000000",
  borderDark: "#000000",
  sticky: "#FEF08A",
  hot: "#C02020",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#C02020",
};

export const typography = {
  heading: {
    fontSize: 26,
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 18,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "600" as const },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
};

export const shadows = {
  neu: {
    shadowColor: "#204060",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  neuSm: {
    shadowColor: "#204060",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
};

export const navigationTheme = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  contentStyle: { backgroundColor: colors.background },
};
