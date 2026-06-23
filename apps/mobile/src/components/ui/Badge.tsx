import { colors } from "@/theme";
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.card,
  },
  text: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
