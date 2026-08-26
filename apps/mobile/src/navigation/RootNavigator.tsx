import { checkRequiredWorkPermissions, startLocationTracking } from "@/lib/locationTracking";
import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import { useAuth } from "@/providers/auth-provider";
import { colors } from "@/theme";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

const MainTabs = lazyNamed(() => import("@/navigation/MainTabs"), "MainTabs");
const LoginScreen = lazyNamed(() => import("@/screens/LoginScreen"), "LoginScreen");
const LocationConsentScreen = lazyNamed(
  () => import("@/screens/LocationConsentScreen"),
  "LocationConsentScreen",
);

export function RootNavigator() {
  const { status, logout } = useAuth();
  /** null = checking; true = must show gate; false = may enter app.
   * CRM is locked unless OS location is Allow all the time / Always. */
  const [needsPermissions, setNeedsPermissions] = useState<boolean | null>(null);

  const evaluatePermissions = useCallback(async () => {
    const perms = await checkRequiredWorkPermissions();
    // Start GPS whenever Always location is granted — call-log must not block tracking.
    // startLocationTracking coalesces stacked calls and already flushes the offline queue.
    if (perms.locationGranted) {
      void startLocationTracking();
    }
    if (perms.allGranted) {
      setNeedsPermissions(false);
      return;
    }
    setNeedsPermissions(true);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setNeedsPermissions(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const perms = await checkRequiredWorkPermissions();
      if (cancelled) return;
      if (perms.locationGranted) {
        void startLocationTracking();
      }
      if (perms.allGranted) {
        setNeedsPermissions(false);
        return;
      }
      setNeedsPermissions(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void evaluatePermissions();
    });
    return () => sub.remove();
  }, [status, evaluatePermissions]);

  if (status !== "authenticated") {
    return (
      <ScreenSuspense>
        <LoginScreen />
      </ScreenSuspense>
    );
  }

  if (needsPermissions === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (needsPermissions) {
    return (
      <ScreenSuspense>
        <LocationConsentScreen
          onDone={() => {
            void evaluatePermissions();
          }}
        />
      </ScreenSuspense>
    );
  }

  return (
    <ScreenSuspense>
      <MainTabs onLogout={() => void logout()} />
    </ScreenSuspense>
  );
}
