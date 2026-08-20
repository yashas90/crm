import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import type { LeadsStackParamList } from "@/navigation/types";
import { navigationTheme } from "@/theme";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const Stack = createNativeStackNavigator<LeadsStackParamList>();

const LeadsScreen = lazyNamed(() => import("@/screens/LeadsScreen"), "LeadsScreen");
const LeadCreateScreen = lazyNamed(() => import("@/screens/LeadCreateScreen"), "LeadCreateScreen");
const LeadDetailScreen = lazyNamed(() => import("@/screens/LeadDetailScreen"), "LeadDetailScreen");

export function LeadsStack() {
  return (
    <ScreenSuspense>
      <Stack.Navigator screenOptions={navigationTheme}>
        <Stack.Screen name="LeadsScreen" component={LeadsScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="LeadCreateScreen"
          component={LeadCreateScreen}
          options={{ title: "New lead" }}
        />
        <Stack.Screen
          name="LeadDetailScreen"
          component={LeadDetailScreen}
          getId={({ params }) => params.leadId}
          options={{ title: "Lead detail" }}
        />
      </Stack.Navigator>
    </ScreenSuspense>
  );
}
