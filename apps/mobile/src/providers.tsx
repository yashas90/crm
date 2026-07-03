import { useNotificationSound } from "@/hooks/use-notification-sound";
import { usePushNotificationSync } from "@/hooks/use-push-notification-sync";
import { queryClient } from "@/lib/queryClient";
import { setupQueryFocusManager } from "@/lib/setupQueryFocusManager";
import { setupQueryOnlineManager } from "@/lib/setupQueryOnlineManager";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { NetworkProvider } from "@/providers/network-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { colors } from "@/theme";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

function NotificationEffects() {
  usePushNotificationSync();
  useNotificationSound();
  return null;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return children;
}

function AppEffects() {
  useEffect(() => {
    setupQueryOnlineManager();
    return setupQueryFocusManager();
  }, []);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <NetworkProvider>
            <QueryClientProvider client={queryClient}>
              <AppEffects />
              <NotificationEffects />
              <AuthGate>{children}</AuthGate>
            </QueryClientProvider>
          </NetworkProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
