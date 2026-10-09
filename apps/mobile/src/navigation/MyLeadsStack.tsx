import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import type { MyLeadsStackParamList } from "@/navigation/types";
import { navigationTheme } from "@/theme";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const Stack = createNativeStackNavigator<MyLeadsStackParamList>();
const MyLeadsScreen = lazyNamed(() => import("@/screens/MyLeadsScreen"), "MyLeadsScreen");
const MyLeadDetailScreen = lazyNamed(
  () => import("@/screens/MyLeadDetailScreen"),
  "MyLeadDetailScreen",
);

export function MyLeadsStack() {
  return (
    <ScreenSuspense>
      <Stack.Navigator screenOptions={navigationTheme}>
        <Stack.Screen
          name="MyLeadsHome"
          component={MyLeadsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyLeadDetail"
          component={MyLeadDetailScreen}
          options={{ title: "Lead" }}
        />
      </Stack.Navigator>
    </ScreenSuspense>
  );
}
