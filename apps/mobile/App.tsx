import { InAppNotificationBanner } from "@/components/InAppNotificationBanner";
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
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  const navRef = useNavigationContainerRef<MainTabParamList>();

  const handleNavigateToLead = useCallback(
    (leadId: string) => {
      navigateToLeadFromPush(navRef as NavigationContainerRefWithCurrent<MainTabParamList>, leadId);
    },
    [navRef],
  );

  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const leadId = typeof data?.leadId === "string" ? data.leadId : null;
      if (leadId) {
        handleNavigateToLead(leadId);
      }
    });
    return () => sub.remove();
  }, [handleNavigateToLead]);

  return (
    <SafeAreaProvider>
      <Providers>
        <NavigationContainer ref={navRef} linking={appLinking}>
          <RootNavigator />
          <InAppNotificationBanner onNavigateToLead={handleNavigateToLead} />
        </NavigationContainer>
        <StatusBar style="light" />
      </Providers>
    </SafeAreaProvider>
  );
}
