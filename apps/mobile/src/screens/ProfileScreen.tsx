import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCurrentUser } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/apiClient";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useState } from "react";
import {
  ActivityIndicator,
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
  const insets = useSafeAreaInsets();

  async function handleLogout() {
    setLoggingOut(true);
    try {
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
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
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
        <InfoRow icon="globe-outline" label="API" value={getApiUrl()} mono />
        <InfoRow
          icon="information-circle-outline"
          label="Version"
          value={Constants.expoConfig?.version ?? "1.0.0"}
        />
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
  logoutBtn: { marginTop: spacing.lg },
  footer: {
    color: colors.textMutedDark,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.md,
    textAlign: "center",
  },
});
