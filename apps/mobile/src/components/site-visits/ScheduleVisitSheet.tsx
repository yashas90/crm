import { type SiteVisit, formatVisitTime, useCreateSiteVisit } from "@/hooks/use-site-visits";
import {
  addSiteVisitToDeviceCalendar,
  formatVisitManualDetails,
  siteVisitToMobileCalendarInput,
} from "@/lib/addVisitToCalendar";
import { colors, radii, spacing, typography } from "@/theme";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScheduleVisitSheetProps = {
  visible: boolean;
  leadId: string;
  leadName?: string;
  leadPhone?: string | null;
  onClose: () => void;
  onScheduled?: () => void;
};

export function ScheduleVisitSheet({
  visible,
  leadId,
  leadName,
  leadPhone,
  onClose,
  onScheduled,
}: ScheduleVisitSheetProps) {
  const createVisit = useCreateSiteVisit();
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [visitTime, setVisitTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [confirmedVisit, setConfirmedVisit] = useState<SiteVisit | null>(null);
  const [calendarToast, setCalendarToast] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);

  function resetForm() {
    setVisitDate(new Date().toISOString().slice(0, 10));
    setVisitTime("10:00");
    setDuration("60");
    setNotes("");
    setPropertyAddress("");
    setConfirmedVisit(null);
    setCalendarToast(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleConfirm() {
    try {
      const created = await createVisit.mutateAsync({
        leadId,
        visitDate,
        visitTime,
        duration: Number(duration) || 60,
        notes: notes.trim() || null,
        propertyAddress: propertyAddress.trim() || null,
      });
      onScheduled?.();
      setConfirmedVisit(created);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not schedule visit");
    }
  }

  async function handleAddToCalendar() {
    if (!confirmedVisit) return;

    const calendarInput = siteVisitToMobileCalendarInput({
      ...confirmedVisit,
      lead: confirmedVisit.lead ?? {
        firstName: leadName?.split(" ")[0] ?? "Lead",
        lastName: leadName?.split(" ").slice(1).join(" ") ?? "",
        phone: leadPhone ?? null,
      },
    });

    setAddingToCalendar(true);
    try {
      const result = await addSiteVisitToDeviceCalendar(calendarInput);
      if (result === "added") {
        setCalendarToast(true);
        setTimeout(() => setCalendarToast(false), 2500);
        return;
      }

      Alert.alert(
        result === "denied" ? "Calendar access denied" : "Calendar unavailable",
        `Add this visit manually:\n\n${formatVisitManualDetails(calendarInput)}`,
      );
    } finally {
      setAddingToCalendar(false);
    }
  }

  const calendarInput = confirmedVisit
    ? siteVisitToMobileCalendarInput({
        ...confirmedVisit,
        lead: confirmedVisit.lead ?? {
          firstName: leadName?.split(" ")[0] ?? "Lead",
          lastName: leadName?.split(" ").slice(1).join(" ") ?? "",
          phone: leadPhone ?? null,
        },
      })
    : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          {confirmedVisit && calendarInput ? (
            <>
              <Text style={styles.title}>Visit scheduled</Text>
              <Text style={styles.subtitle}>
                {calendarInput.leadName} · {confirmedVisit.visitDate} ·{" "}
                {formatVisitTime(confirmedVisit.visitTime)} · {confirmedVisit.duration} min
              </Text>
              <Text style={styles.confirmProperty}>
                {confirmedVisit.propertyLabel ??
                  confirmedVisit.propertyAddress ??
                  calendarInput.projectName ??
                  "Property TBD"}
              </Text>

              <Pressable
                style={[styles.primaryBtn, addingToCalendar && styles.disabled]}
                onPress={() => void handleAddToCalendar()}
                disabled={addingToCalendar}
              >
                <Text style={styles.primaryBtnText}>
                  {addingToCalendar ? "Adding…" : "Add to phone calendar"}
                </Text>
              </Pressable>

              {calendarToast ? <Text style={styles.successToast}>Added to calendar ✓</Text> : null}

              <Pressable onPress={handleClose} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Schedule site visit</Text>
              {leadName ? <Text style={styles.subtitle}>{leadName}</Text> : null}

              <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={visitDate}
                onChangeText={setVisitDate}
                placeholderTextColor={colors.textMutedDark}
              />

              <Text style={styles.label}>Time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={visitTime}
                onChangeText={setVisitTime}
                placeholder="10:00"
                placeholderTextColor={colors.textMutedDark}
              />

              <Text style={styles.label}>Duration (minutes)</Text>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMutedDark}
              />

              <Text style={styles.label}>Property address</Text>
              <TextInput
                style={styles.input}
                value={propertyAddress}
                onChangeText={setPropertyAddress}
                placeholder="Site / project address"
                placeholderTextColor={colors.textMutedDark}
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholderTextColor={colors.textMutedDark}
              />

              <Pressable
                style={[styles.primaryBtn, createVisit.isPending && styles.disabled]}
                onPress={() => void handleConfirm()}
                disabled={createVisit.isPending}
              >
                <Text style={styles.primaryBtnText}>
                  {createVisit.isPending ? "Scheduling…" : "Confirm"}
                </Text>
              </Pressable>
              <Pressable onPress={handleClose}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.cardDark,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: { ...typography.subheading, color: colors.textDark },
  subtitle: { color: colors.textMutedDark, marginBottom: spacing.sm },
  confirmProperty: {
    color: colors.textDark,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  label: { color: colors.textMutedDark, fontSize: 12, fontWeight: "600", marginTop: spacing.sm },
  input: {
    backgroundColor: colors.backgroundDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    color: colors.textDark,
    padding: spacing.sm,
  },
  notes: { minHeight: 72, textAlignVertical: "top" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.md,
  },
  disabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  successToast: {
    color: colors.primaryLight,
    textAlign: "center",
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  doneBtn: { alignItems: "center", paddingVertical: spacing.md },
  doneBtnText: { color: colors.textMutedDark, fontWeight: "600" },
  cancel: { color: colors.textMutedDark, textAlign: "center", paddingVertical: spacing.md },
});
