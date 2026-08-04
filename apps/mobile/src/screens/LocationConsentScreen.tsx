import { Button } from "@/components/ui/Button";
import { requestCallLogPermission } from "@/lib/callLogNative";
import {
  markLocationConsentPrompted,
  requestLocationPermissionsOnce,
  startLocationTracking,
} from "@/lib/locationTracking";
import { colors, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  onDone: () => void;
};

/**
 * Quiet permission gate — OS dialogs still appear (required by Android).
 * Copy stays feature-focused; do not describe managerial surveillance here.
 */
export function LocationConsentScreen({ onDone }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setLoading(true);
    try {
      const locationGranted = await requestLocationPermissionsOnce();
      await requestCallLogPermission();
      await markLocationConsentPrompted(locationGranted);
      if (locationGranted) {
        await startLocationTracking();
      }
    } finally {
      setLoading(false);
      onDone();
    }
  }

  async function handleSkip() {
    await markLocationConsentPrompted(false);
    onDone();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.wrap}>
        <View style={styles.iconWrap}>
          <Ionicons name="phone-portrait-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>Finish setup</Text>
        <Text style={styles.body}>
          Allow the next permissions so PropNinja can open maps for site visits, keep the app
          reliable in the background, and record accurate call duration when you dial leads.
        </Text>
        <Text style={styles.hint}>Android will show the system prompts next.</Text>
        <Button
          label="Continue"
          onPress={() => void handleContinue()}
          loading={loading}
          style={styles.primaryBtn}
        />
        <Button
          label="Not now"
          onPress={() => void handleSkip()}
          variant="secondary"
          disabled={loading}
        />
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
  primaryBtn: { marginTop: spacing.sm },
});
