import { colors } from "@/theme";
import { type ComponentType, type ReactNode, Suspense, lazy } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

/** Lazy-load a named screen export (Metro code-splits the module). */
export function lazyNamed<P extends object>(
  factory: () => Promise<Record<string, ComponentType<P>>>,
  exportName: string,
): ComponentType<P> {
  return lazy(async () => {
    const mod = await factory();
    const Comp = mod[exportName];
    if (!Comp) {
      throw new Error(`lazyNamed: export "${exportName}" not found`);
    }
    return { default: Comp };
  }) as ComponentType<P>;
}

export function ScreenSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ScreenFallback />}>{children}</Suspense>;
}

function ScreenFallback() {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
