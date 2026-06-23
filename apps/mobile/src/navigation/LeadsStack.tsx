import type { LeadsStackParamList } from "@/navigation/types";
import { LeadCreateScreen } from "@/screens/LeadCreateScreen";
import { LeadDetailScreen } from "@/screens/LeadDetailScreen";
import { LeadsScreen } from "@/screens/LeadsScreen";
import { navigationTheme } from "@/theme";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const Stack = createNativeStackNavigator<LeadsStackParamList>();

export function LeadsStack() {
  return (
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
        options={{ title: "Lead detail" }}
      />
    </Stack.Navigator>
  );
}
