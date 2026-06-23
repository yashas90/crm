import { colors, radii, spacing } from "@/theme";
import {
  followUpAtIstDaysFromNow,
  formatDateTimeIst,
  getIstDateKey,
  getIstHourMinute,
  parseVisitStartIst,
} from "@propninja/types/ist";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function followUpDaysFromNow(days: number, hour = 9, minute = 0): string {
  return followUpAtIstDaysFromNow(days, hour, minute);
}

export function followUpTodayAt(hour: number, minute = 0): string {
  return followUpAtIstDaysFromNow(0, hour, minute);
}

export function formatFollowUpLabel(iso: string | null): string {
  if (!iso) return "Not set";
  return formatDateTimeIst(iso, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TODAY_TIME_SLOTS = [
  { label: "11 AM", hour: 11, minute: 0 },
  { label: "1 PM", hour: 13, minute: 0 },
  { label: "3 PM", hour: 15, minute: 0 },
  { label: "5 PM", hour: 17, minute: 0 },
  { label: "7 PM", hour: 19, minute: 0 },
] as const;

const LATER_OPTIONS = [
  { label: "Tomorrow", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
] as const;

type FollowUpQuickPickerProps = {
  value: string | null;
  onChange: (iso: string | null) => void;
};

export function FollowUpQuickPicker({ value, onChange }: FollowUpQuickPickerProps) {
  const [customDate, setCustomDate] = useState(() => getIstDateKey());
  const [customTime, setCustomTime] = useState(() => {
    const { hour } = getIstHourMinute();
    const nextHour = Math.min(hour + 1, 21);
    return `${String(nextHour).padStart(2, "0")}:00`;
  });

  function applyCustomDateTime() {
    const trimmedDate = customDate.trim();
    const trimmedTime = customTime.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD format.");
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(trimmedTime)) {
      Alert.alert("Invalid time", "Use HH:MM format (24-hour).");
      return;
    }
    try {
      onChange(parseVisitStartIst(trimmedDate, trimmedTime).toISOString());
    } catch {
      Alert.alert("Invalid date/time", "Could not schedule that follow-up.");
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.current}>{formatFollowUpLabel(value)}</Text>

      <Text style={styles.groupLabel}>Today (IST)</Text>
      <View style={styles.row}>
        {TODAY_TIME_SLOTS.map((slot) => (
          <Pressable
            key={slot.label}
            style={styles.chip}
            onPress={() => onChange(followUpTodayAt(slot.hour, slot.minute))}
          >
            <Text style={styles.chipText}>{slot.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.groupLabel}>Later</Text>
      <View style={styles.row}>
        {LATER_OPTIONS.map((opt) => (
          <Pressable
            key={opt.days}
            style={styles.chip}
            onPress={() => onChange(followUpDaysFromNow(opt.days))}
          >
            <Text style={styles.chipText}>{opt.label}</Text>
          </Pressable>
        ))}
        <Pressable style={[styles.chip, styles.chipMuted]} onPress={() => onChange(null)}>
          <Text style={[styles.chipText, styles.chipTextMuted]}>Clear</Text>
        </Pressable>
      </View>

      <Text style={styles.groupLabel}>Pick date & time</Text>
      <View style={styles.customRow}>
        <TextInput
          style={[styles.input, styles.dateInput]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          value={customDate}
          onChangeText={setCustomDate}
        />
        <TextInput
          style={[styles.input, styles.timeInput]}
          placeholder="HH:MM"
          placeholderTextColor={colors.textMuted}
          value={customTime}
          onChangeText={setCustomTime}
        />
        <Pressable style={styles.applyBtn} onPress={applyCustomDateTime}>
          <Text style={styles.applyBtnText}>Set</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Times are in India (Kolkata). Use today&apos;s date to reschedule for later today.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  current: { color: colors.textMuted, fontSize: 13 },
  groupLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipMuted: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  chipTextMuted: { color: colors.text },
  customRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
  },
  dateInput: { flex: 1.4 },
  timeInput: { flex: 0.8 },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
});
