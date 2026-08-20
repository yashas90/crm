import { InAppNotificationBanner } from "@/components/InAppNotificationBanner";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { appLinking } from "@/lib/linking";
import { addNotificationResponseListener } from "@/lib/pushNotifications";
import { RootNavigator } from "@/navigation/RootNavigator";
import { navigateToLeadFromPush } from "@/navigation/pushNavigation";
import type { MainTabParamList } from "@/navigation/types";
import { Providers } from "@/providers";
import {
  NavigationContainer,
  type NavigationContainerRefWithCurrent,
  useNavigationContainerRef,
} from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const navRef = useNavigationContainerRef<MainTabParamList>();

  const handleNavigateToLead = useCallback(
    (leadId: string) => {
      navigateToLeadFromPush(navRef as NavigationContainerRefWithCurrent<MainTabParamList>, leadId);
    },
    [navRef],
  );

  useEffect(() => {
    // Defer notification deep-link wiring until after first paint.
    let sub: { remove: () => void } | null = null;
    const timer = setTimeout(() => {
      sub = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        const leadId = typeof data?.leadId === "string" ? data.leadId : null;
        if (leadId) {
          handleNavigateToLead(leadId);
        }
      });
    }, 0);
    return () => {
      clearTimeout(timer);
      sub?.remove();
    };
  }, [handleNavigateToLead]);

  return (
    <SafeAreaProvider>
      <ErrorBoundary screenName="app">
        <Providers onCriticalReady={() => void SplashScreen.hideAsync()}>
          <NavigationContainer ref={navRef} linking={appLinking}>
            <RootNavigator />
            <InAppNotificationBanner onNavigateToLead={handleNavigateToLead} />
          </NavigationContainer>
          <StatusBar style="light" />
        </Providers>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
