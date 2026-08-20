import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import type { TeamStackParamList } from "@/navigation/types";
import { navigationTheme } from "@/theme";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";

const Stack = createNativeStackNavigator<TeamStackParamList>();

const ManagerHomeScreen = lazyNamed(
  () => import("@/screens/ManagerHomeScreen"),
  "ManagerHomeScreen",
);
const TeamCallLogsScreen = lazyNamed(
  () => import("@/screens/TeamCallLogsScreen"),
  "TeamCallLogsScreen",
);

const detailScreenOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === "ios",
};

export function TeamStack() {
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
          name="TeamHomeScreen"
          component={ManagerHomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TeamCallLogsScreen"
          component={TeamCallLogsScreen}
          options={{ title: "Team call logs", ...detailScreenOptions }}
        />
      </Stack.Navigator>
    </ScreenSuspense>
  );
}
