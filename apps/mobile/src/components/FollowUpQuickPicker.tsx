import { colors, radii, spacing } from "@/theme";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function followUpDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

export function formatFollowUpLabel(iso: string | null): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type FollowUpQuickPickerProps = {
  value: string | null;
  onChange: (iso: string | null) => void;
};

export function FollowUpQuickPicker({ value, onChange }: FollowUpQuickPickerProps) {
  const options = [
    { label: "Tomorrow", days: 1 },
    { label: "In 3 days", days: 3 },
    { label: "In 7 days", days: 7 },
  ] as const;

  return (
    <View style={styles.wrap}>
      <Text style={styles.current}>{formatFollowUpLabel(value)}</Text>
      <View style={styles.row}>
        {options.map((opt) => (
          <Pressable
            key={opt.days}
            style={styles.chip}
            onPress={() => onChange(followUpDaysFromNow(opt.days))}
          >
            <Text style={styles.chipText}>{opt.label}</Text>
          </Pressable>
        ))}
        <Pressable style={[styles.chip, styles.chipMuted]} onPress={() => onChange(null)}>
          <Text style={styles.chipText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  current: { color: colors.textMutedDark, fontSize: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipMuted: {
    backgroundColor: colors.cardDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
