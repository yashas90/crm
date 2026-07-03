import type { ProfileStackParamList } from "@/navigation/types";
import { BookingsScreen } from "@/screens/BookingsScreen";
import { CallLogsScreen } from "@/screens/CallLogsScreen";
import { DocumentsLibraryScreen } from "@/screens/DocumentsLibraryScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { ProjectDetailScreen } from "@/screens/ProjectDetailScreen";
import { ProjectUnitScreen } from "@/screens/ProjectUnitScreen";
import { ProjectsScreen } from "@/screens/ProjectsScreen";
import { SlaScreen } from "@/screens/SlaScreen";
import { UserManagementScreen } from "@/screens/UserManagementScreen";
import { navigationTheme } from "@/theme";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

const detailScreenOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: Platform.OS === "ios",
};

type ProfileStackProps = {
  onLogout: () => void;
};

export function ProfileStack({ onLogout }: ProfileStackProps) {
  return (
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
  );
}
