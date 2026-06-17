import { colors, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus, StyleSheet, Text, View } from "react-native";

/**
 * Covers the app when backgrounded so lead data is not visible in the OS app switcher.
 */
export function AppPrivacyOverlay() {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    const handleChange = (nextState: AppStateStatus) => {
      setBlurred(nextState === "inactive" || nextState === "background");
    };

    const subscription = AppState.addEventListener("change", handleChange);
    return () => subscription.remove();
  }, []);

  if (!blurred) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto" accessibilityLabel="PropNinja privacy screen">
      <Ionicons name="shield-checkmark" size={56} color={colors.primaryLight} />
      <Text style={styles.title}>PropNinja</Text>
      <Text style={styles.subtitle}>Your session is protected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundDark,
    gap: 12,
  },
  title: {
    ...typography.heading,
    color: colors.textDark,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMutedDark,
  },
});
