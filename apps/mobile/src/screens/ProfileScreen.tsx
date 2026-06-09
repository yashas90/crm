import { useCurrentUser } from "@/hooks/use-auth";
import { API_URL } from "@/lib/apiClient";
import { clearAuth } from "@/lib/auth";
import { colors, radii, spacing } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import Constants from "expo-constants";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ProfileScreenProps = {
  onLogout: () => void;
};

export function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const [callReminders, setCallReminders] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const { data: user, isLoading, refetch, isRefetching } = useCurrentUser();
  const insets = useSafeAreaInsets();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await clearAuth();
      onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom },
      ]}
    >
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        {isLoading && !user ? (
          <ActivityIndicator color={colors.primaryLight} />
        ) : (
          <>
            <InfoRow label="Name" value={user?.name ?? "—"} />
            <InfoRow label="Email" value={user?.email ?? "—"} />
            <InfoRow label="Role" value={user?.role ?? "—"} />
            <InfoRow label="User ID" value={user?.id ?? "—"} />
          </>
        )}
        <Pressable style={styles.refreshBtn} onPress={() => void refetch()} disabled={isRefetching}>
          <Text style={styles.refreshText}>
            {isRefetching ? "Refreshing..." : "Refresh profile"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingLabel}>Call reminders</Text>
            <Text style={styles.settingHint}>Local placeholder toggle</Text>
          </View>
          <Switch
            value={callReminders}
            onValueChange={setCallReminders}
            trackColor={{ false: "#334155", true: "#2563eb" }}
          />
        </View>
        <InfoRow label="API URL" value={API_URL} />
        <InfoRow label="App version" value={Constants.expoConfig?.version ?? "1.0.0"} />
      </View>

      <Pressable style={styles.logoutBtn} onPress={() => void handleLogout()} disabled={loggingOut}>
        {loggingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.logoutText}>Logout</Text>
        )}
      </Pressable>

      <Text style={styles.footer}>
        PropNinja Mobile uses your device SIM for outbound calls. No VoIP.
      </Text>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  content: {
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.textDark,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 12,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  row: {
    gap: 4,
  },
  label: {
    color: colors.textMutedDark,
    fontSize: 13,
    fontWeight: "600",
  },
  value: {
    color: colors.textDark,
    fontSize: 15,
  },
  refreshBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  refreshText: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: "600",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    color: colors.textDark,
    fontSize: 15,
    fontWeight: "600",
  },
  settingHint: {
    color: colors.textMutedDark,
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  footer: {
    color: colors.textMutedDark,
    fontSize: 13,
    lineHeight: 20,
  },
});
