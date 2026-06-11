import { colors, radii } from "@/theme";
import { StyleSheet, Text, View } from "react-native";

type BadgeProps = {
  label: string;
  backgroundColor?: string;
  color?: string;
};

export function Badge({ label, backgroundColor, color }: BadgeProps) {
  return (
    <View style={[styles.badge, backgroundColor ? { backgroundColor } : null]}>
      <Text style={[styles.text, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  text: {
    color: colors.textMutedDark,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
});
