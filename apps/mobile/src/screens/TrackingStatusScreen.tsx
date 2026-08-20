import { Button } from "@/components/ui/Button";
import { apiGet } from "@/lib/apiClient";
import {
  checkRequiredWorkPermissions,
  openAppPermissionSettings,
  registerTrackingDevice,
  startLocationTracking,
} from "@/lib/locationTracking";
import { colors, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { AppState, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MeStatus = {
  config: {
    enabled: boolean;
    scheduleLabel: string;
    startTime: string;
    endTime: string;
    withinHours: boolean;
  };
  trackingPolicyEnabled: boolean;
  device: {
    locationPermissionStatus: string | null;
    callLogPermissionStatus: string | null;
    healthStatus: string | null;
    deviceStatus: string | null;
    lastSeenAt: string | null;
    lastHeartbeatAt: string | null;
    lastLocationAt: string | null;
  } | null;
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export function TrackingStatusScreen() {
  const [status, setStatus] = useState<MeStatus | null>(null);
  const [perms, setPerms] = useState<{ locationGranted: boolean; callLogGranted: boolean } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [me, nextPerms] = await Promise.all([
        apiGet<MeStatus>("/api/locations/me/status"),
        checkRequiredWorkPermissions(),
      ]);
      setStatus(me);
      setPerms({
        locationGranted: nextPerms.locationGranted,
        callLogGranted: nextPerms.callLogGranted,
      });
      void registerTrackingDevice();
    } catch {
      // Keep previous
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const trackingActive =
    Boolean(status?.config.enabled) &&
    Boolean(status?.trackingPolicyEnabled) &&
    Boolean(perms?.locationGranted) &&
    Boolean(status?.config.withinHours);

  const reason = !status?.config.enabled
    ? "Tracking is turned off by your organization."
    : !status?.trackingPolicyEnabled
      ? "Tracking is disabled for your account by an admin."
      : !perms?.locationGranted
        ? "Location permission has been revoked or is not Allow all the time."
        : !status?.config.withinHours
          ? "Outside working hours — scheduled tracking is paused."
          : null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
        <Text style={styles.title}>Location Tracking</Text>
        <Text style={[styles.value, trackingActive ? styles.ok : styles.warn]}>
          {trackingActive ? "ACTIVE" : "PAUSED"}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Working Hours</Text>
          <Text style={styles.body}>{status?.config.scheduleLabel ?? "09:30–20:30 IST"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Location Permission</Text>
          <Text style={styles.body}>
            {perms?.locationGranted ? "GRANTED (Allow all the time)" : "DENIED / RESTRICTED"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Call Log Permission</Text>
          <Text style={styles.body}>
            {status?.device?.callLogPermissionStatus ??
              (perms?.callLogGranted ? "GRANTED" : "DENIED / UNAVAILABLE")}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Last Location Sync</Text>
          <Text style={styles.body}>{formatTime(status?.device?.lastLocationAt)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Last Device Sync</Text>
          <Text style={styles.body}>
            {formatTime(status?.device?.lastHeartbeatAt ?? status?.device?.lastSeenAt)}
          </Text>
        </View>

        {reason ? (
          <View style={styles.warnBox}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>Reason</Text>
              <Text style={styles.body}>{reason}</Text>
            </View>
          </View>
        ) : null}

        {!perms?.locationGranted ? (
          <Button
            label="Open Device Settings"
            onPress={() => void openAppPermissionSettings()}
            style={{ marginTop: spacing.md }}
          />
        ) : (
          <Button
            label="Refresh tracking"
            onPress={() => void startLocationTracking().then(() => refresh())}
            style={{ marginTop: spacing.md }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  title: { ...typography.heading, color: colors.text },
  value: { ...typography.h2, marginBottom: spacing.md },
  ok: { color: colors.success },
  warn: { color: colors.warning },
  card: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  body: { ...typography.body, color: colors.text },
  warnBox: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 8,
  },
  warnTitle: { ...typography.caption, color: colors.warning, marginBottom: 2 },
});
