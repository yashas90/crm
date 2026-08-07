import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  currentVersion: string;
  minVersion: string | null;
  updateUrl: string | null;
  onRetry: () => void;
};

export function ForceUpdateScreen({ currentVersion, minVersion, updateUrl, onRetry }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.wrap}>
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-download-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>Update required</Text>
        <Text style={styles.body}>
          This version of PropNinja ({currentVersion}) is no longer supported
          {minVersion ? ` — please install ${minVersion} or newer` : ""}. Older apps cannot access
          leads or call logging after a new release.
        </Text>
        {updateUrl ? (
          <Button
            label="Get the latest app"
            onPress={() => void Linking.openURL(updateUrl)}
            style={styles.primaryBtn}
          />
        ) : (
          <Text style={styles.hint}>
            Ask your admin for the latest PropNinja APK, install it, then open the app again.
          </Text>
        )}
        <Button label="Check again" onPress={onRetry} variant="secondary" />
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
    lineHeight: 20,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  primaryBtn: { marginTop: spacing.sm },
});
