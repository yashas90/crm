import { addNotificationResponseListener } from "@/lib/pushNotifications";
import { RootNavigator } from "@/navigation/RootNavigator";
import { Providers } from "@/providers";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  const navRef = useNavigationContainerRef();

  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const leadId = typeof data?.leadId === "string" ? data.leadId : null;
      if (leadId && navRef.isReady()) {
        // Navigate to Leads tab then push the detail screen
        (navRef as ReturnType<typeof useNavigationContainerRef>).dispatch({
          type: "NAVIGATE",
          payload: { name: "Leads" },
        });
        setTimeout(() => {
          (navRef as ReturnType<typeof useNavigationContainerRef>).dispatch({
            type: "NAVIGATE",
            payload: { name: "LeadDetailScreen", params: { leadId } },
          });
        }, 80);
      }
    });
    return () => sub.remove();
  }, [navRef]);

  return (
    <SafeAreaProvider>
      <Providers>
        <NavigationContainer ref={navRef}>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="light" />
      </Providers>
    </SafeAreaProvider>
  );
}
