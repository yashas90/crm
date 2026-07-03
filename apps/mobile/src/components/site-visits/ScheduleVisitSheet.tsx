import { useProjectUnits, useProjectsList } from "@/hooks/use-projects";
import { type SiteVisit, formatVisitTime, useCreateSiteVisit } from "@/hooks/use-site-visits";
import {
  addSiteVisitToDeviceCalendar,
  formatVisitManualDetails,
  siteVisitToMobileCalendarInput,
} from "@/lib/addVisitToCalendar";
import { openCustomerSiteVisitWhatsApp } from "@/lib/siteVisitWhatsApp";
import { colors, radii, spacing, typography } from "@/theme";
import { getIstDateKey } from "@propninja/types/ist";
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
  const projects = useProjectsList();
  const [visitDate, setVisitDate] = useState(() => getIstDateKey());
  const [visitTime, setVisitTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [tower, setTower] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const units = useProjectUnits(selectedProjectId ?? "", undefined);
  const [confirmedVisit, setConfirmedVisit] = useState<SiteVisit | null>(null);
  const [calendarToast, setCalendarToast] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  function resetForm() {
    setVisitDate(getIstDateKey());
    setVisitTime("10:00");
    setEndTime("11:00");
    setDuration("60");
    setNotes("");
    setPropertyAddress("");
    setMeetingLocation("");
    setMapsLink("");
    setCustomerEmail("");
    setTower("");
    setSelectedProjectId(null);
    setSelectedUnitId(null);
    setConfirmedVisit(null);
    setCalendarToast(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function computeDurationFromTimes(start: string, end: string) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMins = (sh ?? 0) * 60 + (sm ?? 0);
    const endMins = (eh ?? 0) * 60 + (em ?? 0);
    const diff = endMins - startMins;
    return diff > 0 ? diff : Number(duration) || 60;
  }

  async function handleConfirm() {
    if (!leadPhone?.trim()) {
      Alert.alert(
        "Phone required",
        "This lead needs a mobile number before scheduling a site visit.",
      );
      return;
    }

    try {
      const created = await createVisit.mutateAsync({
        leadId,
        projectId: selectedProjectId,
        unitId: selectedUnitId,
        tower: tower.trim() || null,
        visitDate,
        visitTime,
        duration: computeDurationFromTimes(visitTime, endTime),
        notes: notes.trim() || null,
        propertyAddress: propertyAddress.trim() || null,
        meetingLocation: meetingLocation.trim() || null,
        mapsLink: mapsLink.trim() || null,
        customerEmail: customerEmail.trim() || null,
      });
      onScheduled?.();
      setConfirmedVisit(created);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not schedule visit");
    }
  }

  async function handleWhatsAppCustomer() {
    if (!confirmedVisit) return;
    setSendingWhatsApp(true);
    try {
      const result = await openCustomerSiteVisitWhatsApp(confirmedVisit, "scheduled");
      if (!result.ok) {
        Alert.alert(
          "WhatsApp",
          result.error === "NO_PHONE"
            ? "Customer has no phone number on file."
            : "Could not open WhatsApp on this device.",
        );
      }
    } finally {
      setSendingWhatsApp(false);
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
                style={[styles.secondaryBtn, sendingWhatsApp && styles.disabled]}
                onPress={() => void handleWhatsAppCustomer()}
                disabled={sendingWhatsApp}
              >
                <Text style={styles.secondaryBtnText}>
                  {sendingWhatsApp ? "Opening WhatsApp…" : "Message customer on WhatsApp"}
                </Text>
              </Pressable>

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

              <Text style={styles.label}>Project</Text>
              {projects.isLoading ? (
                <Text style={styles.hint}>Loading projects…</Text>
              ) : projects.isError ? (
                <Text style={styles.hint}>Could not load projects. Try again later.</Text>
              ) : (projects.data ?? []).length === 0 ? (
                <Text style={styles.hint}>
                  No active projects. Add a project in the web app first.
                </Text>
              ) : (
                <View style={styles.projectList}>
                  {(projects.data ?? []).map((project) => {
                    const selected = selectedProjectId === project.id;
                    return (
                      <Pressable
                        key={project.id}
                        style={[styles.projectRow, selected && styles.projectRowSelected]}
                        onPress={() => {
                          setSelectedProjectId(project.id);
                          setSelectedUnitId(null);
                        }}
                      >
                        <Text style={[styles.projectName, selected && styles.projectNameSelected]}>
                          {project.name}
                        </Text>
                        {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {selectedProjectId ? (
                <>
                  <Text style={styles.label}>Tower</Text>
                  <TextInput
                    style={styles.input}
                    value={tower}
                    onChangeText={setTower}
                    placeholder="Tower A"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={styles.label}>Unit</Text>
                  {units.isLoading ? (
                    <Text style={styles.hint}>Loading units…</Text>
                  ) : (
                    <View style={styles.projectList}>
                      {(units.data ?? []).map((unit) => {
                        const selected = selectedUnitId === unit.id;
                        return (
                          <Pressable
                            key={unit.id}
                            style={[styles.projectRow, selected && styles.projectRowSelected]}
                            onPress={() => setSelectedUnitId(unit.id)}
                          >
                            <Text
                              style={[styles.projectName, selected && styles.projectNameSelected]}
                            >
                              {unit.unitNumber}
                            </Text>
                            {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}

              <Text style={styles.label}>Customer phone</Text>
              <Text style={styles.hint}>
                {leadPhone?.trim() || "No phone on lead — required to schedule"}
              </Text>

              <Text style={styles.label}>Customer email (optional)</Text>
              <TextInput
                style={styles.input}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                placeholder="For calendar invite"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={visitDate}
                onChangeText={setVisitDate}
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Start time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={visitTime}
                onChangeText={setVisitTime}
                placeholder="10:00"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>End time (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="11:00"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Meeting location</Text>
              <TextInput
                style={styles.input}
                value={meetingLocation}
                onChangeText={setMeetingLocation}
                placeholder="Sales office, model flat, etc."
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Google Maps link</Text>
              <TextInput
                style={styles.input}
                value={mapsLink}
                onChangeText={setMapsLink}
                placeholder="https://maps.google.com/..."
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Property address</Text>
              <TextInput
                style={styles.input}
                value={propertyAddress}
                onChangeText={setPropertyAddress}
                placeholder="Site / project address"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholderTextColor={colors.textMuted}
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
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: { ...typography.subheading, color: colors.text },
  subtitle: { color: colors.textMuted, marginBottom: spacing.sm },
  confirmProperty: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
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
  secondaryBtn: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: "700" },
  successToast: {
    color: colors.primary,
    textAlign: "center",
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  doneBtn: { alignItems: "center", paddingVertical: spacing.md },
  doneBtnText: { color: colors.textMuted, fontWeight: "600" },
  cancel: { color: colors.textMuted, textAlign: "center", paddingVertical: spacing.md },
  projectList: { gap: spacing.xs, marginBottom: spacing.sm },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  projectRowSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}14`,
  },
  projectName: { color: colors.text, fontWeight: "500", flex: 1 },
  projectNameSelected: { color: colors.primary, fontWeight: "700" },
  checkmark: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
});
