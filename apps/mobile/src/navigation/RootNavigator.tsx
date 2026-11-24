import { checkRequiredWorkPermissions, startLocationTracking } from "@/lib/locationTracking";
import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import { useAuth } from "@/providers/auth-provider";
import { colors } from "@/theme";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

const MainTabs = lazyNamed(() => import("@/navigation/MainTabs"), "MainTabs");
const LoginScreen = lazyNamed(() => import("@/screens/LoginScreen"), "LoginScreen");
const LocationConsentScreen = lazyNamed(
  () => import("@/screens/LocationConsentScreen"),
  "LocationConsentScreen",
);

/** Skip permission re-checks on every dialer return — they remount MainTabs and look like a crash. */
const PERMISSION_REEVAL_DEBOUNCE_MS = 60_000;

export function RootNavigator() {
  const { status, logout } = useAuth();
  /** null = checking; true = must show gate; false = may enter app.
   * CRM is locked unless OS location is Allow all the time / Always. */
  const [needsPermissions, setNeedsPermissions] = useState<boolean | null>(null);
  const lastEvalAtRef = useRef(0);
  const consecutiveFailRef = useRef(0);

  const evaluatePermissions = useCallback(async (opts?: { force?: boolean }) => {
    const now = Date.now();
    if (!opts?.force && now - lastEvalAtRef.current < PERMISSION_REEVAL_DEBOUNCE_MS) {
      return;
    }
    lastEvalAtRef.current = now;

    const perms = await checkRequiredWorkPermissions();
    // Start GPS whenever Always location is granted — call-log must not block tracking.
    // startLocationTracking coalesces stacked calls and already flushes the offline queue.
    if (perms.locationGranted) {
      void startLocationTracking();
    }
    if (perms.allGranted) {
      consecutiveFailRef.current = 0;
      setNeedsPermissions(false);
      return;
    }

    // A single flaky battery-opt / call-log check after dialer return must not tear down
    // the whole app (unmount MainTabs → feels like a restart mid-calling session).
    consecutiveFailRef.current += 1;
    setNeedsPermissions((prev) => {
      if (prev === false && consecutiveFailRef.current < 2) return false;
      return true;
    });
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setNeedsPermissions(null);
      consecutiveFailRef.current = 0;
      lastEvalAtRef.current = 0;
      return;
    }

    let cancelled = false;
    void (async () => {
      lastEvalAtRef.current = Date.now();
      const perms = await checkRequiredWorkPermissions();
      if (cancelled) return;
      if (perms.locationGranted) {
        void startLocationTracking();
      }
      if (perms.allGranted) {
        consecutiveFailRef.current = 0;
        setNeedsPermissions(false);
        return;
      }
      consecutiveFailRef.current = 1;
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
            void evaluatePermissions({ force: true });
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
