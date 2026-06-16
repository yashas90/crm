import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCurrentUser } from "@/hooks/use-auth";
import { useTodayCallSummary } from "@/hooks/use-calls";
import { useLeadScopeCounts } from "@/hooks/use-leads";
import { useMyTasks } from "@/hooks/use-tasks";
import { getApiUrl } from "@/lib/apiClient";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
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

type ProfileScreenProps = {
  onLogout: () => void;
};

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
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
          tintColor={colors.primaryLight}
        />
      }
    >
      <View style={styles.profileHeader}>
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

      <Text style={styles.sectionTitle}>Today's performance</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{callSummary?.total_calls ?? "—"}</Text>
          <Text style={styles.statLabel}>Calls today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{scopeCounts?.my ?? "—"}</Text>
          <Text style={styles.statLabel}>My leads</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{myTasks?.total ?? "—"}</Text>
          <Text style={styles.statLabel}>Open tasks</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Account</Text>
      <Card>
        {isLoading && !user ? (
          <ActivityIndicator color={colors.primaryLight} />
        ) : (
          <>
            <InfoRow icon="mail-outline" label="Email" value={user?.email ?? "—"} />
            <InfoRow icon="finger-print-outline" label="User ID" value={user?.id ?? "—"} mono />
          </>
        )}
      </Card>

      <Text style={styles.sectionTitle}>App</Text>
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
        <Ionicons name={icon} size={18} color={colors.primaryLight} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  content: { padding: spacing.md },
  profileHeader: { alignItems: "center", marginBottom: spacing.lg, marginTop: spacing.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  name: { ...typography.heading, color: colors.textDark, fontSize: 22 },
  role: {
    color: colors.primaryLight,
    textTransform: "capitalize",
    fontWeight: "600",
    marginTop: 4,
    fontSize: 14,
  },
  sectionTitle: {
    color: colors.textMutedDark,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  row: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderDark },
  rowLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: colors.textMutedDark, fontSize: 13, fontWeight: "600" },
  value: { color: colors.textDark, fontSize: 15 },
  mono: { fontSize: 12, lineHeight: 18 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderDark,
    alignItems: "center",
  },
  statValue: {
    color: colors.primaryLight,
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.textMutedDark,
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  logoutBtn: { marginTop: spacing.lg },
  linkBtn: { marginTop: spacing.sm },
  footer: {
    color: colors.textMutedDark,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.md,
    textAlign: "center",
  },
});
