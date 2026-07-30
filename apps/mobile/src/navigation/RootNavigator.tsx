import {
  hasLocationConsentPromptBeenShown,
  markLocationConsentPrompted,
  startLocationTracking,
} from "@/lib/locationTracking";
import { MainTabs } from "@/navigation/MainTabs";
import { useAuth } from "@/providers/auth-provider";
import { LocationConsentScreen } from "@/screens/LocationConsentScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { colors } from "@/theme";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export function RootNavigator() {
  const { status, logout } = useAuth();
  const [needsConsent, setNeedsConsent] = useState<boolean | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setNeedsConsent(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const prompted = await hasLocationConsentPromptBeenShown();
      if (cancelled) return;
      if (prompted) {
        setNeedsConsent(false);
        return;
      }

      // Reinstall / upgrade where OS permission is already granted — skip UI, never re-ask.
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      if (cancelled) return;
      if (bgStatus === "granted") {
        await markLocationConsentPrompted(true);
        await startLocationTracking();
        if (!cancelled) setNeedsConsent(false);
        return;
      }

      setNeedsConsent(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status !== "authenticated") {
    return <LoginScreen />;
  }

  if (needsConsent === null) {
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

  if (needsConsent) {
    return <LocationConsentScreen onDone={() => setNeedsConsent(false)} />;
  }

  return <MainTabs onLogout={() => void logout()} />;
}
