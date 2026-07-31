import { colors, radii, spacing } from "@/theme";
import {
  followUpAtIstDaysFromNow,
  formatDateTimeIst,
  getIstDateKey,
  getIstHourMinute,
  parseVisitStartIst,
} from "@propninja/types/ist";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

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

function dateFromIstParts(dateKey: string, timeHm: string): Date {
  try {
    return parseVisitStartIst(dateKey, timeHm);
  } catch {
    return new Date();
  }
}

function formatDisplayDate(dateKey: string): string {
  try {
    return parseVisitStartIst(dateKey, "12:00").toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateKey;
  }
}

function formatDisplayTime(timeHm: string): string {
  const [h, m] = timeHm.split(":").map(Number);
  const hour = h ?? 0;
  const minute = m ?? 0;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function FollowUpQuickPicker({ value, onChange }: FollowUpQuickPickerProps) {
  const [customDate, setCustomDate] = useState(() => getIstDateKey());
  const [customTime, setCustomTime] = useState(() => {
    const { hour } = getIstHourMinute();
    const nextHour = Math.min(hour + 1, 21);
    return `${String(nextHour).padStart(2, "0")}:00`;
  });
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);

  const pickerValue = useMemo(
    () => dateFromIstParts(customDate, customTime),
    [customDate, customTime],
  );

  function applyCustomDateTime(dateKey = customDate, timeHm = customTime) {
    try {
      onChange(parseVisitStartIst(dateKey, timeHm).toISOString());
    } catch {
      Alert.alert("Invalid date/time", "Could not schedule that follow-up.");
    }
  }

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") {
      setPickerMode(null);
    }
    if (event.type === "dismissed" || !selected) {
      if (Platform.OS === "ios") setPickerMode(null);
      return;
    }

    const dateKey = getIstDateKey(selected);
    const { hour, minute } = getIstHourMinute(selected);
    const timeHm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    if (pickerMode === "date") {
      setCustomDate(dateKey);
      if (Platform.OS === "ios") setPickerMode(null);
    } else if (pickerMode === "time") {
      setCustomTime(timeHm);
      if (Platform.OS === "ios") setPickerMode(null);
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
        <Pressable
          style={[styles.input, styles.dateInput]}
          onPress={() => setPickerMode("date")}
          accessibilityRole="button"
          accessibilityLabel="Pick follow-up date"
        >
          <Text style={styles.inputText}>{formatDisplayDate(customDate)}</Text>
        </Pressable>
        <Pressable
          style={[styles.input, styles.timeInput]}
          onPress={() => setPickerMode("time")}
          accessibilityRole="button"
          accessibilityLabel="Pick follow-up time"
        >
          <Text style={styles.inputText}>{formatDisplayTime(customTime)}</Text>
        </Pressable>
        <Pressable style={styles.applyBtn} onPress={() => applyCustomDateTime()}>
          <Text style={styles.applyBtnText}>Set</Text>
        </Pressable>
      </View>

      {pickerMode ? (
        <DateTimePicker
          value={pickerValue}
          mode={pickerMode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPickerChange}
          // Wall clock is IST for CRM follow-ups
          timeZoneName="Asia/Kolkata"
        />
      ) : null}

      <Text style={styles.hint}>
        Times are in India (Kolkata). Tap date for calendar, time for clock.
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    justifyContent: "center",
  },
  inputText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  dateInput: { flex: 1.4 },
  timeInput: { flex: 0.9 },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
});
