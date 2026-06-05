import { colors, radii, spacing, typography } from "@/theme";
import { type ReactNode, createContext, useContext } from "react";

const theme = { colors, radii, spacing, typography };

type ThemeContextValue = typeof theme;

const ThemeContext = createContext<ThemeContextValue>(theme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children as ReactNode}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { colors, radii, spacing, typography };
