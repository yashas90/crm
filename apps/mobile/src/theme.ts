export const colors = {
  primary: "#6366f1",
  primaryLight: "#818cf8",
  primaryDark: "#4f46e5",
  accent: "#818cf8",
  background: "#0f172a",
  backgroundDark: "#0f172a",
  card: "#1e293b",
  cardDark: "#1e293b",
  cardElevated: "#253348",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textDark: "#f1f5f9",
  textMutedDark: "#94a3b8",
  border: "#334155",
  borderDark: "#334155",
  sticky: "#312e81",
  hot: "#f87171",
  success: "#4ade80",
  warning: "#fbbf24",
  danger: "#f87171",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardSm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
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
    color: colors.text,
  },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};
