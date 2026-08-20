import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import type { ProfileStackParamList } from "@/navigation/types";
import { navigationTheme } from "@/theme";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

const ProfileScreen = lazyNamed(() => import("@/screens/ProfileScreen"), "ProfileScreen");
const DocumentsLibraryScreen = lazyNamed(
  () => import("@/screens/DocumentsLibraryScreen"),
  "DocumentsLibraryScreen",
);
const CallLogsScreen = lazyNamed(() => import("@/screens/CallLogsScreen"), "CallLogsScreen");
const TrackingStatusScreen = lazyNamed(
  () => import("@/screens/TrackingStatusScreen"),
  "TrackingStatusScreen",
);
const UserManagementScreen = lazyNamed(
  () => import("@/screens/UserManagementScreen"),
  "UserManagementScreen",
);
const ProjectsScreen = lazyNamed(() => import("@/screens/ProjectsScreen"), "ProjectsScreen");
const ProjectDetailScreen = lazyNamed(
  () => import("@/screens/ProjectDetailScreen"),
  "ProjectDetailScreen",
);
const BookingsScreen = lazyNamed(() => import("@/screens/BookingsScreen"), "BookingsScreen");
const SlaScreen = lazyNamed(() => import("@/screens/SlaScreen"), "SlaScreen");
const ProjectUnitScreen = lazyNamed(
  () => import("@/screens/ProjectUnitScreen"),
  "ProjectUnitScreen",
);

const detailScreenOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === "ios",
};

type ProfileStackProps = {
  onLogout: () => void;
};

export function ProfileStack({ onLogout }: ProfileStackProps) {
  return (
    <ScreenSuspense>
      <Stack.Navigator
        screenOptions={{
          ...navigationTheme,
          gestureEnabled: true,
          fullScreenGestureEnabled: Platform.OS === "ios",
        }}
      >
        <Stack.Screen name="ProfileScreen" options={{ headerShown: false }}>
          {({ navigation }) => (
            <ProfileScreen
              onLogout={onLogout}
              onOpenUserManagement={() => navigation.navigate("UserManagementScreen")}
              onOpenProjects={() => navigation.navigate("ProjectsScreen")}
              onOpenBookings={() => navigation.navigate("BookingsScreen")}
              onOpenDocuments={() => navigation.navigate("DocumentsLibraryScreen")}
              onOpenCallLogs={() => navigation.navigate("CallLogsScreen")}
              onOpenTrackingStatus={() => navigation.navigate("TrackingStatusScreen")}
              onOpenSla={() => navigation.navigate("SlaScreen")}
              onOpenSiteVisits={() => navigation.getParent()?.navigate("VisitsTab")}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="DocumentsLibraryScreen"
          component={DocumentsLibraryScreen}
          options={{ title: "Documents", ...detailScreenOptions }}
        />
        <Stack.Screen
          name="CallLogsScreen"
          component={CallLogsScreen}
          options={{ title: "Call Logs", ...detailScreenOptions }}
        />
        <Stack.Screen
          name="TrackingStatusScreen"
          component={TrackingStatusScreen}
          options={{ title: "Tracking status", ...detailScreenOptions }}
        />
        <Stack.Screen
          name="UserManagementScreen"
          component={UserManagementScreen}
          options={{ title: "Users", ...detailScreenOptions }}
        />
        <Stack.Screen
          name="ProjectsScreen"
          component={ProjectsScreen}
          options={{ title: "Projects", ...detailScreenOptions }}
        />
        <Stack.Screen
          name="ProjectDetailScreen"
          component={ProjectDetailScreen}
          options={{ title: "Units", ...detailScreenOptions }}
        />
        <Stack.Screen
          name="BookingsScreen"
          component={BookingsScreen}
          options={{ title: "Bookings", ...detailScreenOptions }}
        />
        <Stack.Screen
          name="SlaScreen"
          component={SlaScreen}
          options={{ title: "Lead SLA", ...detailScreenOptions }}
        />
        <Stack.Screen
          name="ProjectUnitScreen"
          component={ProjectUnitScreen}
          options={{ title: "Unit", ...detailScreenOptions }}
        />
      </Stack.Navigator>
    </ScreenSuspense>
  );
}
