import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { useIsManager } from "@/hooks/use-role";
import { useTodaySiteVisits } from "@/hooks/use-site-visits";
import { useOpenTaskCount } from "@/hooks/use-tasks";
import { LeadsStack } from "@/navigation/LeadsStack";
import { ProfileStack } from "@/navigation/ProfileStack";
import { TeamStack } from "@/navigation/TeamStack";
import { VisitsStack } from "@/navigation/VisitsStack";
import type { MainTabParamList } from "@/navigation/types";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
import { PipelineScreen } from "@/screens/PipelineScreen";
import { TasksScreen } from "@/screens/TasksScreen";
import { TodayScreen } from "@/screens/TodayScreen";
import { colors, navigationTheme } from "@/theme";
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
      color={focused ? colors.primary : colors.textMuted}
    />
  );
}

type MainTabsProps = {
  onLogout: () => void;
};

export function MainTabs({ onLogout }: MainTabsProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;
  const isManager = useIsManager();
  const unreadCount = useUnreadNotificationCount();
  const todayVisits = useTodaySiteVisits();
  const visitsBadgeCount =
    todayVisits.data?.items.filter((v) => v.status === "scheduled").length ?? 0;
  const visitsBadge =
    visitsBadgeCount > 0 ? (visitsBadgeCount > 9 ? "9+" : visitsBadgeCount) : undefined;
  const openTaskCount = useOpenTaskCount();
  const notificationBadge = unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined;
  const tasksBadge =
    openTaskCount !== undefined ? (openTaskCount > 9 ? "9+" : openTaskCount) : undefined;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "#1e293b",
          borderTopColor: "#334155",
          borderTopWidth: 0.5,
          elevation: 16,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="LeadsTab"
        component={LeadsStack}
        options={{
          title: "Leads",
          tabBarIcon: ({ focused }) => tabIcon("people-outline", focused),
        }}
      />
      <Tab.Screen
        name="PipelineTab"
        component={PipelineScreen}
        options={{
          title: "Pipeline",
          tabBarIcon: ({ focused }) => tabIcon("git-network-outline", focused),
          headerShown: true,
          ...navigationTheme,
        }}
      />
      {isManager ? (
        <Tab.Screen
          name="TeamTab"
          component={TeamStack}
          options={{
            title: "Team",
            tabBarIcon: ({ focused }) => tabIcon("people-circle-outline", focused),
            headerShown: false,
          }}
        />
      ) : (
        <Tab.Screen
          name="TodayTab"
          component={TodayScreen}
          options={{
            title: "Today",
            tabBarIcon: ({ focused }) => tabIcon("today-outline", focused),
            headerShown: true,
            ...navigationTheme,
          }}
        />
      )}
      <Tab.Screen
        name="VisitsTab"
        component={VisitsStack}
        options={{
          title: "Visits",
          tabBarIcon: ({ focused }) => tabIcon("location-outline", focused),
          tabBarBadge: visitsBadge,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: "#ffffff",
            fontSize: 10,
            minWidth: 18,
            lineHeight: 14,
          },
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="TasksTab"
        component={TasksScreen}
        options={{
          title: "Tasks",
          tabBarIcon: ({ focused }) => tabIcon("checkbox-outline", focused),
          tabBarBadge: tasksBadge,
          tabBarBadgeStyle: {
            backgroundColor: colors.hot,
            color: "#ffffff",
            fontSize: 10,
            minWidth: 18,
            lineHeight: 14,
            borderWidth: 1,
            borderColor: colors.border,
          },
          headerShown: false,
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
            color: colors.text,
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
          headerShown: false,
        }}
      >
        {() => <ProfileStack onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
