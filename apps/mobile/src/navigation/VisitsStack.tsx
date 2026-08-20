import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import type { VisitsStackParamList } from "@/navigation/types";
import { navigationTheme } from "@/theme";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";

const Stack = createNativeStackNavigator<VisitsStackParamList>();

const SiteVisitsHomeScreen = lazyNamed(
  () => import("@/screens/SiteVisitsHomeScreen"),
  "SiteVisitsHomeScreen",
);
const SiteVisitsCalendarScreen = lazyNamed(
  () => import("@/screens/SiteVisitsCalendarScreen"),
  "SiteVisitsCalendarScreen",
);

const detailScreenOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === "ios",
};

export function VisitsStack() {
  return (
    <ScreenSuspense>
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
    </ScreenSuspense>
  );
}
