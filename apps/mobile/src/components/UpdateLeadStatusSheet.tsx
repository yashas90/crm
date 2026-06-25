import { FollowUpQuickPicker } from "@/components/FollowUpQuickPicker";
import type { OrgUser } from "@/hooks/use-users";
import { MOBILE_LEAD_STATUS_OPTIONS, formatLeadStatusLabel } from "@/lib/lead-status-options";
import { colors, radii, shadows, spacing } from "@/theme";
import type { LeadStatus } from "@propninja/types/enums";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type UpdateLeadStatusPayload = {
  leadStatus: LeadStatus;
  statusLabel: string;
  notes?: string;
  assignedTo?: string;
  nextFollowupAt?: string | null;
};

type UpdateLeadStatusSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: UpdateLeadStatusPayload) => void;
  currentStatus?: string | null;
  currentAssigneeId?: string | null;
  assigneeOptions?: OrgUser[];
  defaultAssigneeId?: string | null;
  isSaving?: boolean;
};

export function UpdateLeadStatusSheet({
  visible,
  onClose,
  onSave,
  currentStatus,
  currentAssigneeId,
  assigneeOptions = [],
  defaultAssigneeId,
  isSaving = false,
}: UpdateLeadStatusSheetProps) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [nextFollowupAt, setNextFollowupAt] = useState<string | null>(null);

  const showAssignee = assigneeOptions.length > 0;

  useEffect(() => {
    if (!visible) return;
    setSelectedLabel(null);
    setNotes("");
    setAssigneeId(currentAssigneeId ?? defaultAssigneeId ?? null);
    setAssignOpen(false);
    setNextFollowupAt(null);
  }, [visible, currentAssigneeId, defaultAssigneeId]);

  const selectedOption = MOBILE_LEAD_STATUS_OPTIONS.find((o) => o.label === selectedLabel);
  const showFollowUpPicker = selectedOption?.label === "Callback";
  const assigneeName =
    assigneeOptions.find((u) => u.id === assigneeId)?.name ??
    (assigneeId ? "Selected agent" : "You");

  function handleSave() {
    if (!selectedOption) return;
    if (showFollowUpPicker && !nextFollowupAt) {
      Alert.alert("Callback time required", "Pick when to call this lead back.");
      return;
    }
    onSave({
      leadStatus: selectedOption.value,
      statusLabel: selectedOption.label,
      notes: notes.trim() || undefined,
      assignedTo: assigneeId && /^[0-9a-f-]{36}$/i.test(assigneeId) ? assigneeId : undefined,
      nextFollowupAt: showFollowUpPicker ? nextFollowupAt : undefined,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={["bottom"]} style={styles.sheetSafe}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.title} testID="update-lead-status-title">
                Update lead status
              </Text>
              <Text style={styles.subtitle}>
                You can update the status of your essential lead after the call.
              </Text>

              <View style={styles.previousBanner}>
                <Text style={styles.previousBannerText}>
                  {currentStatus
                    ? `Previous: ${formatLeadStatusLabel(currentStatus)}`
                    : "No previous status found"}
                </Text>
              </View>

              <Text style={styles.sectionLabel}>Select status</Text>
              <View style={styles.chipGrid}>
                {MOBILE_LEAD_STATUS_OPTIONS.map((option) => {
                  const active = selectedLabel === option.label;
                  return (
                    <Pressable
                      key={option.label}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedLabel(option.label)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {showAssignee ? (
                <>
                  <Text style={styles.sectionLabel}>Assign to</Text>
                  <Pressable
                    style={styles.assignSelect}
                    onPress={() => setAssignOpen((open) => !open)}
                  >
                    <Text style={styles.assignSelectText}>{assigneeName}</Text>
                    <Text style={styles.assignChevron}>{assignOpen ? "▲" : "▼"}</Text>
                  </Pressable>
                  {assignOpen ? (
                    <View style={styles.assignList}>
                      {assigneeOptions.map((user) => (
                        <Pressable
                          key={user.id}
                          style={[
                            styles.assignOption,
                            assigneeId === user.id && styles.assignOptionActive,
                          ]}
                          onPress={() => {
                            setAssigneeId(user.id);
                            setAssignOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.assignOptionText,
                              assigneeId === user.id && styles.assignOptionTextActive,
                            ]}
                          >
                            {user.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              {showFollowUpPicker ? (
                <>
                  <Text style={styles.sectionLabel}>Callback time</Text>
                  <FollowUpQuickPicker value={nextFollowupAt} onChange={setNextFollowupAt} />
                </>
              ) : null}

              <Text style={styles.sectionLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                numberOfLines={4}
                placeholder="Enter something here…"
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />

              <View style={styles.actions}>
                <Pressable style={styles.cancelButton} onPress={onClose} disabled={isSaving}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.saveButton,
                    (!selectedOption || isSaving) && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!selectedOption || isSaving}
                  testID="update-lead-status-save"
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save & finish</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetSafe: { maxHeight: "92%" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: "100%",
    ...shadows.neu,
  },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  previousBanner: {
    backgroundColor: "#1e293b",
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  previousBannerText: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.sm,
    textTransform: "capitalize",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: { color: "#fff" },
  assignSelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  assignSelectText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  assignChevron: { color: colors.textMuted, fontSize: 12 },
  assignList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: "hidden",
    marginTop: 4,
  },
  assignOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  assignOptionActive: { backgroundColor: `${colors.primary}15` },
  assignOptionText: { color: colors.text, fontSize: 14 },
  assignOptionTextActive: { color: colors.primary, fontWeight: "700" },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 96,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
