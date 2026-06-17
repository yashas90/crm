import { colors, spacing } from "@/theme";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type OfflineBannerProps = {
  visible: boolean;
};

export function OfflineBanner({ visible }: OfflineBannerProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top > 0 ? insets.top : spacing.sm }]}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.danger,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
});
