import { useDeferredStartupReady } from "@/hooks/use-deferred-startup";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { useIsAgent, useIsManager } from "@/hooks/use-role";
import { useTodaySiteVisits } from "@/hooks/use-site-visits";
import { useOpenTaskCount } from "@/hooks/use-tasks";
import { apiGet } from "@/lib/apiClient";
import { LeadsStack } from "@/navigation/LeadsStack";
import { ScrollableTabBar } from "@/navigation/ScrollableTabBar";
import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import type { MainTabParamList } from "@/navigation/types";
import { colors, navigationTheme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";

const Tab = createBottomTabNavigator<MainTabParamList>();

// Leads is the default tab — eager import avoids blank native-stack + React.lazy.
const ProfileStack = lazyNamed(() => import("@/navigation/ProfileStack"), "ProfileStack");
const TeamStack = lazyNamed(() => import("@/navigation/TeamStack"), "TeamStack");
const VisitsStack = lazyNamed(() => import("@/navigation/VisitsStack"), "VisitsStack");
const PipelineScreen = lazyNamed(() => import("@/screens/PipelineScreen"), "PipelineScreen");
const TodayScreen = lazyNamed(() => import("@/screens/TodayScreen"), "TodayScreen");
const TasksScreen = lazyNamed(() => import("@/screens/TasksScreen"), "TasksScreen");
const DialPadScreen = lazyNamed(() => import("@/screens/DialPadScreen"), "DialPadScreen");
const CallingDataScreen = lazyNamed(
  () => import("@/screens/CallingDataScreen"),
  "CallingDataScreen",
);
const MyLeadsStack = lazyNamed(() => import("@/navigation/MyLeadsStack"), "MyLeadsStack");
const NotificationsScreen = lazyNamed(
  () => import("@/screens/NotificationsScreen"),
  "NotificationsScreen",
);

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IoniconName) {
  const activeName = (
    name.endsWith("-outline") ? name.slice(0, -"-outline".length) : name
  ) as IoniconName;
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? activeName : name} size={size} color={color} />
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
  const isManager = useIsManager();
  const isAgent = useIsAgent();
  const { visitsBadge, notificationBadge, tasksBadge } = useDeferredTabBadges();
  const callingBadgeQuery = useQuery({
    queryKey: ["calling-stats"],
    queryFn: () => apiGet<{ badge: number }>("/api/agent/calling-data/stats"),
    enabled: isAgent,
    retry: false,
    refetchInterval: false,
    meta: { suppressErrorToast: true },
  });
  const leadsBadgeQuery = useQuery({
    queryKey: ["my-leads-stats"],
    queryFn: () => apiGet<{ hot: number }>("/api/agent/leads/stats"),
    enabled: isAgent,
    retry: false,
    refetchInterval: false,
    meta: { suppressErrorToast: true },
  });
  const callingBadge = callingBadgeQuery.data?.badge || undefined;
  const hotBadge = leadsBadgeQuery.data?.hot || undefined;

  return (
    <ScreenSuspense>
      <Tab.Navigator
        tabBar={ScrollableTabBar}
        screenOptions={{
          headerShown: false,
          lazy: true,
        }}
      >
        <Tab.Screen
          name="LeadsTab"
          component={LeadsStack}
          options={{
            title: "Leads",
            tabBarIcon: tabIcon("people-outline"),
          }}
        />
        <Tab.Screen
          name="PipelineTab"
          component={PipelineScreen}
          options={{
            title: "Pipeline",
            tabBarIcon: tabIcon("git-network-outline"),
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
              tabBarIcon: tabIcon("people-circle-outline"),
              headerShown: false,
            }}
          />
        ) : (
          <Tab.Screen
            name="TodayTab"
            component={TodayScreen}
            options={{
              title: "Today",
              tabBarIcon: tabIcon("today-outline"),
              headerShown: true,
              ...navigationTheme,
            }}
          />
        )}
        <Tab.Screen
          name="DialPadTab"
          component={DialPadScreen}
          options={{
            title: "Dial",
            tabBarIcon: tabIcon("call-outline"),
            headerShown: false,
          }}
        />
        {isAgent ? (
          <Tab.Screen
            name="CallingTab"
            component={CallingDataScreen}
            options={{
              title: "Calling",
              tabBarIcon: tabIcon("call-outline"),
              tabBarBadge: callingBadge,
              headerShown: false,
            }}
          />
        ) : null}
        {isAgent ? (
          <Tab.Screen
            name="MyLeadsTab"
            component={MyLeadsStack}
            options={{
              title: "My Leads",
              tabBarIcon: tabIcon("ribbon-outline"),
              tabBarBadge: hotBadge,
              headerShown: false,
            }}
          />
        ) : null}
        <Tab.Screen
          name="VisitsTab"
          component={VisitsStack}
          options={{
            title: "Visits",
            tabBarIcon: tabIcon("location-outline"),
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
            tabBarIcon: tabIcon("checkbox-outline"),
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
            tabBarIcon: tabIcon("notifications-outline"),
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
            tabBarIcon: tabIcon("person-circle-outline"),
            headerShown: false,
          }}
        >
          {() => <ProfileStack onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </ScreenSuspense>
  );
}
