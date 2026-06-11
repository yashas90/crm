import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { colors } from "@/theme";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.backgroundDark,
        }}
      >
        <ActivityIndicator size="large" color={colors.primaryLight} />
      </View>
    );
  }

  return children;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate>{children}</AuthGate>
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
