import type { VisitsStackParamList } from "@/navigation/types";
import { SiteVisitsCalendarScreen } from "@/screens/SiteVisitsCalendarScreen";
import { SiteVisitsHomeScreen } from "@/screens/SiteVisitsHomeScreen";
import { navigationTheme } from "@/theme";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";

const Stack = createNativeStackNavigator<VisitsStackParamList>();

const detailScreenOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === "ios",
};

export function VisitsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        ...navigationTheme,
        gestureEnabled: true,
        fullScreenGestureEnabled: Platform.OS === "ios",
      }}
    >
      <Stack.Screen
        name="SiteVisitsHomeScreen"
        component={SiteVisitsHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SiteVisitsCalendarScreen"
        component={SiteVisitsCalendarScreen}
        options={{ title: "Calendar", ...detailScreenOptions }}
      />
    </Stack.Navigator>
  );
}
