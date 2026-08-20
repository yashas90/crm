import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCurrentUser } from "@/hooks/use-auth";
import { useTodayCallSummary } from "@/hooks/use-calls";
import { useLeadScopeCounts } from "@/hooks/use-leads";
import { useIsAdmin, useIsAgent } from "@/hooks/use-role";
import { useMyTasks } from "@/hooks/use-tasks";
import { getApiUrl } from "@/lib/apiClient";
import { ScreenSuspense, lazyNamed } from "@/navigation/lazyScreen";
import { colors, radii, shadows, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { screenStyles } from "@/theme/screen";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ProfilePerformanceSection = lazyNamed(
  () => import("@/components/profile/ProfilePerformanceSection"),
  "ProfilePerformanceSection",
);

type ProfileScreenProps = {
  onLogout: () => void;
  onOpenUserManagement?: () => void;
  onOpenProjects?: () => void;
  onOpenBookings?: () => void;
  onOpenDocuments?: () => void;
  onOpenCallLogs?: (dateFilter?: string) => void;
  onOpenTrackingStatus?: () => void;
  onOpenSla?: () => void;
  onOpenSiteVisits?: () => void;
};

export function ProfileScreen({
  onLogout,
  onOpenUserManagement,
  onOpenProjects,
  onOpenBookings,
  onOpenDocuments,
  onOpenCallLogs,
  onOpenTrackingStatus,
  onOpenSla,
  onOpenSiteVisits,
}: ProfileScreenProps) {
  const isAdmin = useIsAdmin();
  const isAgent = useIsAgent();
  const [loggingOut, setLoggingOut] = useState(false);
  const { data: user, isLoading, refetch, isRefetching } = useCurrentUser();
  const { data: callSummary, refetch: refetchCalls } = useTodayCallSummary();
  const { data: scopeCounts, refetch: refetchScope } = useLeadScopeCounts();
  const { data: myTasks, refetch: refetchTasks } = useMyTasks();
  const insets = useSafeAreaInsets();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  function handleRefresh() {
    void Promise.all([refetch(), refetchCalls(), refetchScope(), refetchTasks()]);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={screenStyles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name ?? "A")
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name ?? "—"}</Text>
        <Text style={styles.role}>{user?.role ?? "agent"}</Text>
      </View>

      <Text style={screenStyles.sectionTitle}>Today's performance</Text>
      <View style={styles.statsRow}>
        <View style={screenStyles.statCard}>
          <Text style={screenStyles.statValue}>{callSummary?.total_calls ?? "—"}</Text>
          <Text style={screenStyles.statLabel}>Calls today</Text>
        </View>
        <View style={screenStyles.statCard}>
          <Text style={screenStyles.statValue}>{scopeCounts?.my ?? "—"}</Text>
          <Text style={screenStyles.statLabel}>My leads</Text>
        </View>
        <View style={screenStyles.statCard}>
          <Text style={screenStyles.statValue}>{myTasks?.total ?? "—"}</Text>
          <Text style={screenStyles.statLabel}>Open tasks</Text>
        </View>
      </View>

      <ScreenSuspense>
        <ProfilePerformanceSection onOpenCallLogs={(dateFilter) => onOpenCallLogs?.(dateFilter)} />
      </ScreenSuspense>

      <Text style={screenStyles.sectionTitle}>Workspace</Text>
      <Card>
        {onOpenProjects ? (
          <Button label="Projects & inventory" variant="secondary" onPress={onOpenProjects} />
        ) : null}
        {onOpenBookings ? (
          <Button
            label="Bookings"
            variant="secondary"
            onPress={onOpenBookings}
            style={styles.linkBtn}
          />
        ) : null}
        {onOpenDocuments ? (
          <Button
            label="Document library"
            variant="secondary"
            onPress={onOpenDocuments}
            style={styles.linkBtn}
          />
        ) : null}
        {onOpenSiteVisits ? (
          <Button
            label="Site visits"
            variant="secondary"
            onPress={onOpenSiteVisits}
            style={styles.linkBtn}
          />
        ) : null}
        {onOpenSla ? (
          <Button label="Lead SLA" variant="secondary" onPress={onOpenSla} style={styles.linkBtn} />
        ) : null}
        {isAgent && onOpenCallLogs ? (
          <Button
            label="Call logs"
            variant="secondary"
            onPress={onOpenCallLogs}
            style={styles.linkBtn}
          />
        ) : null}
        {onOpenTrackingStatus ? (
          <Button
            label="Tracking status"
            variant="secondary"
            onPress={onOpenTrackingStatus}
            style={styles.linkBtn}
          />
        ) : null}
        {isAdmin && onOpenUserManagement ? (
          <Button
            label="User management"
            variant="secondary"
            onPress={onOpenUserManagement}
            style={styles.linkBtn}
          />
        ) : null}
      </Card>

      <Text style={screenStyles.sectionTitle}>Account</Text>
      <Card>
        {isLoading && !user ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <InfoRow icon="mail-outline" label="Email" value={user?.email ?? "—"} />
            <InfoRow icon="finger-print-outline" label="User ID" value={user?.id ?? "—"} mono />
          </>
        )}
      </Card>

      <Text style={screenStyles.sectionTitle}>App</Text>
      <Card>
        {__DEV__ ? <InfoRow icon="globe-outline" label="API" value={getApiUrl()} mono /> : null}
        <InfoRow
          icon="information-circle-outline"
          label="Version"
          value={Constants.expoConfig?.version ?? "1.0.0"}
        />
        {Constants.expoConfig?.extra?.privacyPolicyUrl ? (
          <Button
            label="Privacy policy"
            variant="secondary"
            onPress={() => {
              const url = Constants.expoConfig?.extra?.privacyPolicyUrl as string;
              void Linking.openURL(url);
            }}
            style={styles.linkBtn}
          />
        ) : null}
      </Card>

      <Button
        label="Sign out"
        onPress={() => void handleLogout()}
        variant="danger"
        loading={loggingOut}
        style={styles.logoutBtn}
      />

      <Text style={styles.footer}>
        PropNinja uses your device SIM for outbound calls. Calls sync to the CRM in real time.
      </Text>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.neuSm,
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  name: { ...typography.heading, color: colors.text, fontSize: 22 },
  role: {
    color: colors.primary,
    textTransform: "capitalize",
    fontWeight: "700",
    marginTop: 4,
    fontSize: 14,
  },
  row: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  value: { color: colors.text, fontSize: 15, fontWeight: "600" },
  mono: { fontSize: 12, lineHeight: 18 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  logoutBtn: { marginTop: spacing.lg },
  linkBtn: { marginTop: spacing.sm },
  footer: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.md,
    textAlign: "center",
  },
});
