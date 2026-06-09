import { LeadsStack } from "@/navigation/LeadsStack";
import type { MainTabParamList } from "@/navigation/types";
import { HomeScreen } from "@/screens/HomeScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { TodayScreen } from "@/screens/TodayScreen";
import { colors } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IoniconName, focused: boolean) {
  return (
    <Ionicons
      name={name}
      size={focused ? 26 : 22}
      color={focused ? colors.primaryLight : colors.textMutedDark}
    />
  );
}

type MainTabsProps = {
  onLogout: () => void;
};

export function MainTabs({ onLogout }: MainTabsProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          borderTopColor: "rgba(148, 163, 184, 0.3)",
          borderTopWidth: 1,
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: colors.textMutedDark,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => tabIcon("home-outline", focused),
        }}
      />
      <Tab.Screen
        name="LeadsTab"
        component={LeadsStack}
        options={{
          title: "Leads",
          tabBarIcon: ({ focused }) => tabIcon("people-outline", focused),
        }}
      />
      <Tab.Screen
        name="TodayTab"
        component={TodayScreen}
        options={{
          title: "Today",
          tabBarIcon: ({ focused }) => tabIcon("calendar-outline", focused),
          headerShown: true,
          headerStyle: { backgroundColor: colors.backgroundDark },
          headerTintColor: colors.textDark,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => tabIcon("person-circle-outline", focused),
          headerShown: true,
          headerStyle: { backgroundColor: colors.backgroundDark },
          headerTintColor: colors.textDark,
        }}
      >
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
