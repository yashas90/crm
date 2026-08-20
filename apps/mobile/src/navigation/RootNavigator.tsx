import {
  checkRequiredWorkPermissions,
  flushLocationPingQueue,
  startLocationTracking,
} from "@/lib/locationTracking";
import { MainTabs } from "@/navigation/MainTabs";
import { useAuth } from "@/providers/auth-provider";
import { LocationConsentScreen } from "@/screens/LocationConsentScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { colors } from "@/theme";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

export function RootNavigator() {
  const { status, logout } = useAuth();
  /** null = checking; true = must show gate; false = may enter app.
   * CRM is locked unless OS location is Allow all the time / Always. */
  const [needsPermissions, setNeedsPermissions] = useState<boolean | null>(null);

  const evaluatePermissions = useCallback(async () => {
    const perms = await checkRequiredWorkPermissions();
    if (perms.allGranted) {
      await startLocationTracking();
      void flushLocationPingQueue();
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
      if (perms.allGranted) {
        await startLocationTracking();
        if (!cancelled) setNeedsPermissions(false);
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
    return <LoginScreen />;
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
      <LocationConsentScreen
        onDone={() => {
          void evaluatePermissions();
        }}
      />
    );
  }

  return <MainTabs onLogout={() => void logout()} />;
}
