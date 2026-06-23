import type { TeamStackParamList } from "@/navigation/types";
import { ManagerHomeScreen } from "@/screens/ManagerHomeScreen";
import { TeamCallLogsScreen } from "@/screens/TeamCallLogsScreen";
import { navigationTheme } from "@/theme";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";

const Stack = createNativeStackNavigator<TeamStackParamList>();

const detailScreenOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === "ios",
};

export function TeamStack() {
  return (
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
  );
}
