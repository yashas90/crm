import { Button } from "@/components/ui/Button";
import {
  type RequiredWorkPermissions,
  checkRequiredWorkPermissions,
  openAppPermissionSettings,
  requestRequiredWorkPermissions,
} from "@/lib/locationTracking";
import { colors, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  onDone: () => void;
};

/**
 * Hard gate: agents cannot enter the CRM until background location (Allow all the time /
 * Always) and on Android call log are granted. “While using the app” is blocked. No skip.
 */
export function LocationConsentScreen({ onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RequiredWorkPermissions | null>(null);
  const [attempted, setAttempted] = useState(false);

  const refresh = useCallback(async () => {
    const next = await checkRequiredWorkPermissions();
    setStatus(next);
    if (next.allGranted) {
      onDone();
    }
  }, [onDone]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  async function handleContinue() {
    setLoading(true);
    setAttempted(true);
    try {
      const next = await requestRequiredWorkPermissions();
      setStatus(next);
      if (next.allGranted) {
        onDone();
      }
    } finally {
      setLoading(false);
    }
  }

  const missing: string[] = [];
  if (status && !status.locationGranted) {
    missing.push("Location — Allow all the time / Always");
  }
  if (status && !status.callLogGranted && Platform.OS === "android") {
    missing.push("Phone / Call log");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.wrap}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>Permissions required</Text>
        <Text style={styles.body}>
          PropNinja collects location only during company working hours: 9:30 AM–8:30 PM IST, every
          day, about every 30 minutes — including when the app is closed. You must choose Allow all
          the time (not “While using the app”). Call log access (Android) is used to sync permitted
          call metadata for CRM activity — never call audio. Location and call-log tracking data are
          kept for 14 days, then deleted automatically. Only authorized admins can view this data.
          Keep the PropNinja notification on and do not force-stop the app.
        </Text>
        {attempted && missing.length > 0 ? (
          <View style={styles.missingBox}>
            <Text style={styles.missingTitle}>App locked — still needed:</Text>
            {missing.map((item) => (
              <Text key={item} style={styles.missingItem}>
                • {item}
              </Text>
            ))}
            <Text style={styles.missingHint}>
              “While using the app” is not enough. Open Settings → Apps → PropNinja → Permissions →
              Location → Allow all the time, then return here.
            </Text>
          </View>
        ) : null}
        <Text style={styles.hint}>
          Choose Allow all the time on the system prompt. Any other option keeps the app locked.
        </Text>
        <Button
          label={attempted ? "Try again" : "Allow & continue"}
          onPress={() => void handleContinue()}
          loading={loading}
          style={styles.primaryBtn}
        />
        {attempted ? (
          <Button
            label="Open settings"
            onPress={() => void openAppPermissionSettings()}
            variant="secondary"
            disabled={loading}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  wrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  missingBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    gap: 4,
  },
  missingTitle: {
    color: colors.text,
    fontWeight: "600",
    marginBottom: 4,
  },
  missingItem: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  missingHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  primaryBtn: { marginTop: spacing.sm },
});
