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

export function LocationConsentScreen({ onDone }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleEnable() {
    setLoading(true);
    try {
      const locationGranted = await requestLocationPermissionsOnce();
      // Call log is separate — request even if location was denied so managers get talk-time data.
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

  async function handleAskLater() {
    // Persist so we never re-prompt on later logins / app opens.
    await markLocationConsentPrompted(false);
    onDone();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.wrap}>
        <View style={styles.iconWrap}>
          <Ionicons name="location" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>Location & call access</Text>
        <Text style={styles.body}>
          PropNinja needs always-on location (Mon–Sun, all day) and call log access so managers can
          see your live position, travel path, and who you called. Grant “Allow all the time” for
          location when prompted.
        </Text>
        <Text style={styles.hint}>You will only be asked once on this install.</Text>
        <Button
          label="Enable location & call log"
          onPress={() => void handleEnable()}
          loading={loading}
          style={styles.primaryBtn}
        />
        <Button
          label="Ask Me Later"
          onPress={() => void handleAskLater()}
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
