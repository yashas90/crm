import { useDeferredStartupReady } from "@/hooks/use-deferred-startup";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { useIsManager } from "@/hooks/use-role";
import { useTodaySiteVisits } from "@/hooks/use-site-visits";
import { useOpenTaskCount } from "@/hooks/use-tasks";
import { LeadsStack } from "@/navigation/LeadsStack";
import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import type { MainTabParamList } from "@/navigation/types";
import { colors, navigationTheme } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator<MainTabParamList>();

// Leads is the default tab — eager import avoids blank native-stack + React.lazy.
const ProfileStack = lazyNamed(() => import("@/navigation/ProfileStack"), "ProfileStack");
const TeamStack = lazyNamed(() => import("@/navigation/TeamStack"), "TeamStack");
const VisitsStack = lazyNamed(() => import("@/navigation/VisitsStack"), "VisitsStack");
const PipelineScreen = lazyNamed(() => import("@/screens/PipelineScreen"), "PipelineScreen");
const TodayScreen = lazyNamed(() => import("@/screens/TodayScreen"), "TodayScreen");
const TasksScreen = lazyNamed(() => import("@/screens/TasksScreen"), "TasksScreen");
const NotificationsScreen = lazyNamed(
  () => import("@/screens/NotificationsScreen"),
  "NotificationsScreen",
);

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

/** Badge queries run only after first paint so Leads can render first. */
function useDeferredTabBadges() {
  const ready = useDeferredStartupReady();
  const unreadCount = useUnreadNotificationCount({ enabled: ready });
  const todayVisits = useTodaySiteVisits(undefined, { enabled: ready });
  const visitItems = Array.isArray(todayVisits.data?.items) ? todayVisits.data.items : [];
  const visitsBadgeCount = visitItems.filter((v) => v.status === "scheduled").length;
  const visitsBadge =
    visitsBadgeCount > 0 ? (visitsBadgeCount > 9 ? "9+" : visitsBadgeCount) : undefined;
  const openTaskCount = useOpenTaskCount({ enabled: ready });
  const notificationBadge = unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined;
  const tasksBadge =
    openTaskCount !== undefined ? (openTaskCount > 9 ? "9+" : openTaskCount) : undefined;
  return { visitsBadge, notificationBadge, tasksBadge };
}

export function MainTabs({ onLogout }: MainTabsProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;
  const isManager = useIsManager();
  const { visitsBadge, notificationBadge, tasksBadge } = useDeferredTabBadges();

  return (
    <ScreenSuspense>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          lazy: true,
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
    </ScreenSuspense>
  );
}
