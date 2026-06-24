export const colors = {
  primary: "#204060",
  primaryLight: "#2d5a87",
  primaryDark: "#1a3550",
  accent: "#C02020",
  background: "#F4F7FB",
  backgroundDark: "#F4F7FB",
  card: "#ffffff",
  cardDark: "#ffffff",
  text: "#0f172a",
  textMuted: "#64748b",
  textDark: "#0f172a",
  textMutedDark: "#64748b",
  border: "#e2e8f0",
  borderDark: "#e2e8f0",
  sticky: "#FEF08A",
  hot: "#C02020",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#C02020",
};

export const typography = {
  heading: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 20,
    fontWeight: "700" as const,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 17,
    fontWeight: "600" as const,
    letterSpacing: -0.1,
  },
  subheading: {
    fontSize: 16,
    fontWeight: "600" as const,
    letterSpacing: 0,
  },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSm: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  /** @deprecated use card */
  get neu() {
    return shadows.card;
  },
  /** @deprecated use cardSm */
  get neuSm() {
    return shadows.cardSm;
  },
};

export const navigationTheme = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontWeight: "600" as const,
  },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};
