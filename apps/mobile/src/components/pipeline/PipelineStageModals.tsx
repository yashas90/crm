import type { LeadRow } from "@/hooks/use-leads";
import { TERMINAL_LEAD_STATUSES_REQUIRING_CLOSE_REASON } from "@/lib/lead-status-options";
import type { PipelineStage } from "@/lib/pipeline";
import { colors, radii, spacing } from "@/theme";
import type { LeadStatus } from "@propninja/types/enums";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const CLOSE_REASON_OPTIONS = [
  { value: "budget_issue", label: "Budget Issue" },
  { value: "not_serious", label: "Not Serious" },
  { value: "competitor", label: "Went to Competitor" },
  { value: "location_mismatch", label: "Location Mismatch" },
  { value: "project_mismatch", label: "Project Mismatch" },
  { value: "no_response", label: "No Response" },
  { value: "already_purchased", label: "Already Purchased" },
  { value: "future_requirement", label: "Future Requirement" },
  { value: "other", label: "Other" },
];

export function requiresCloseReason(stage: LeadStatus): boolean {
  return (TERMINAL_LEAD_STATUSES_REQUIRING_CLOSE_REASON as readonly string[]).includes(stage);
}

type PipelineStagePickerModalProps = {
  visible: boolean;
  lead: LeadRow | null;
  stages: PipelineStage[];
  onClose: () => void;
  onSelectStage: (stage: LeadStatus) => void;
};

export function PipelineStagePickerModal({
  visible,
  lead,
  stages,
  onClose,
  onSelectStage,
}: PipelineStagePickerModalProps) {
  if (!visible || !lead) return null;

  const options = stages.filter((s) => s.key !== lead.leadStatus);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Move to stage</Text>
          <Text style={styles.subtitle}>
            {lead.firstName} {lead.lastName}
          </Text>
          <ScrollView style={styles.list}>
            {options.map((stage) => (
              <Pressable
                key={stage.id ?? stage.key}
                style={styles.option}
                onPress={() => onSelectStage(stage.key as LeadStatus)}
              >
                <View
                  style={[styles.colorDot, stage.color ? { backgroundColor: stage.color } : null]}
                />
                <Text style={styles.optionText}>{stage.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

type PipelineCloseReasonModalProps = {
  visible: boolean;
  lead: LeadRow | null;
  stage: LeadStatus | null;
  stageLabel: string;
  onClose: () => void;
  onConfirm: (closeReason: string, closeReasonNote?: string) => void;
};

export function PipelineCloseReasonModal({
  visible,
  lead,
  stage,
  stageLabel,
  onClose,
  onConfirm,
}: PipelineCloseReasonModalProps) {
  if (!visible || !lead || !stage) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <CloseReasonForm
          lead={lead}
          stageLabel={stageLabel}
          onCancel={onClose}
          onConfirm={onConfirm}
        />
      </Pressable>
    </Modal>
  );
}

function CloseReasonForm({
  lead,
  stageLabel,
  onCancel,
  onConfirm,
}: {
  lead: LeadRow;
  stageLabel: string;
  onCancel: () => void;
  onConfirm: (closeReason: string, closeReasonNote?: string) => void;
}) {
  const [closeReason, setCloseReason] = useState<string | null>(null);
  const [note, setNote] = useState("");

  return (
    <View style={styles.sheet} onStartShouldSetResponder={() => true}>
      <Text style={styles.title}>Close reason required</Text>
      <Text style={styles.subtitle}>
        {lead.firstName} {lead.lastName} → {stageLabel}
      </Text>
      <ScrollView style={styles.list}>
        {CLOSE_REASON_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.option, closeReason === option.value && styles.optionSelected]}
            onPress={() => setCloseReason(option.value)}
          >
            <Text style={styles.optionText}>{option.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput
        style={styles.noteInput}
        placeholder="Optional note"
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
        multiline
      />
      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.confirmBtn, !closeReason && styles.confirmBtnDisabled]}
          disabled={!closeReason}
          onPress={() => onConfirm(closeReason!, note.trim() || undefined)}
        >
          <Text style={styles.confirmText}>Move lead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "75%",
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: spacing.md },
  list: { maxHeight: 320 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: { backgroundColor: "rgba(59, 130, 246, 0.08)" },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  optionText: { color: colors.text, fontSize: 16 },
  noteInput: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    color: colors.text,
    minHeight: 72,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { color: colors.textMuted, fontWeight: "600" },
  confirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmText: { color: "#fff", fontWeight: "700" },
});
