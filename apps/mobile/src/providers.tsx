import { useDeferredStartupReady } from "@/hooks/use-deferred-startup";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { usePushNotificationSync } from "@/hooks/use-push-notification-sync";
import { setAppUpdateRequiredHandler } from "@/lib/apiClient";
import { type AppUpdateRequirement, checkAppUpdateRequired } from "@/lib/appUpdateGate";
import { getMobileAppVersion } from "@/lib/appVersion";
import { deferUntilIdle } from "@/lib/deferUntilIdle";
import { queryClient } from "@/lib/queryClient";
import { setupQueryFocusManager } from "@/lib/setupQueryFocusManager";
import { setupQueryOnlineManager } from "@/lib/setupQueryOnlineManager";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { NetworkProvider } from "@/providers/network-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { ForceUpdateScreen } from "@/screens/ForceUpdateScreen";
import { colors } from "@/theme";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

function NotificationEffects() {
  const ready = useDeferredStartupReady(800);
  if (!ready) return null;
  return <NotificationEffectsInner />;
}

function NotificationEffectsInner() {
  usePushNotificationSync();
  useNotificationSound();
  return null;
}

function AuthGate({
  children,
  onCriticalReady,
}: {
  children: ReactNode;
  onCriticalReady?: () => void;
}) {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "loading") {
      onCriticalReady?.();
    }
  }, [status, onCriticalReady]);

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

/**
 * Does not block first paint on /health — update check runs after UI is up.
 * If an update is required, swaps to ForceUpdateScreen.
 */
function AppUpdateGate({ children }: { children: ReactNode }) {
  const [requirement, setRequirement] = useState<AppUpdateRequirement | null>({
    required: false,
    minVersion: null,
    updateUrl: null,
    currentVersion: getMobileAppVersion(),
  });

  const evaluate = useCallback(async () => {
    const next = await checkAppUpdateRequired();
    setRequirement(next);
  }, []);

  useEffect(() => {
    return deferUntilIdle(() => {
      void evaluate();
    }, 400);
  }, [evaluate]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void evaluate();
    });
    return () => sub.remove();
  }, [evaluate]);

  useEffect(() => {
    setAppUpdateRequiredHandler(() => {
      setRequirement({
        required: true,
        minVersion: null,
        updateUrl: null,
        currentVersion: getMobileAppVersion(),
      });
      void evaluate();
    });
    return () => setAppUpdateRequiredHandler(null);
  }, [evaluate]);

  if (requirement?.required) {
    return (
      <ForceUpdateScreen
        currentVersion={requirement.currentVersion}
        minVersion={requirement.minVersion}
        updateUrl={requirement.updateUrl}
        onRetry={() => {
          void evaluate();
        }}
      />
    );
  }

  return children;
}

function AppEffects() {
  useEffect(() => {
    return deferUntilIdle(() => {
      setupQueryOnlineManager();
    }, 300);
  }, []);

  useEffect(() => {
    return setupQueryFocusManager();
  }, []);

  return null;
}

export function Providers({
  children,
  onCriticalReady,
}: {
  children: ReactNode;
  onCriticalReady?: () => void;
}) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <NetworkProvider>
            <QueryClientProvider client={queryClient}>
              <AppEffects />
              <NotificationEffects />
              <AppUpdateGate>
                <AuthGate onCriticalReady={onCriticalReady}>{children}</AuthGate>
              </AppUpdateGate>
            </QueryClientProvider>
          </NetworkProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
