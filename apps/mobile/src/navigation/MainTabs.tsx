import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { LeadsStack } from "@/navigation/LeadsStack";
import type { MainTabParamList } from "@/navigation/types";
import { HomeScreen } from "@/screens/HomeScreen";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
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
  const unreadCount = useUnreadNotificationCount();
  const notificationBadge = unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: colors.cardDark,
          borderTopColor: colors.borderDark,
          borderTopWidth: 1,
          elevation: 16,
          shadowColor: "#000",
          shadowOpacity: 0.25,
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
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          title: "Alerts",
          tabBarIcon: ({ focused }) => tabIcon("notifications-outline", focused),
          tabBarBadge: notificationBadge,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger,
            color: colors.textDark,
            fontSize: 10,
            minWidth: 18,
            lineHeight: 14,
          },
          headerShown: false,
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
