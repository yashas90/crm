import { FollowUpQuickPicker } from "@/components/FollowUpQuickPicker";
import type { LeadDetail } from "@/hooks/use-leads";
import { colors, radii, spacing, typography } from "@/theme";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const STATUSES = ["new", "contacted", "qualified", "negotiation", "won", "lost"] as const;
const TEMPERATURES = ["cold", "warm", "hot"] as const;

type LeadEditModalProps = {
  visible: boolean;
  lead: LeadDetail;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
};

export function LeadEditModal({ visible, lead, isSaving, onClose, onSave }: LeadEditModalProps) {
  const [leadStatus, setLeadStatus] = useState(lead.leadStatus);
  const [temperature, setTemperature] = useState(lead.temperature ?? "");
  const [secondaryPhone, setSecondaryPhone] = useState(lead.secondaryPhone ?? "");
  const [tags, setTags] = useState((lead.tags ?? []).join(", "));
  const [nextFollowupAt, setNextFollowupAt] = useState<string | null>(lead.nextFollowupAt);

  useEffect(() => {
    setLeadStatus(lead.leadStatus);
    setTemperature(lead.temperature ?? "");
    setSecondaryPhone(lead.secondaryPhone ?? "");
    setTags((lead.tags ?? []).join(", "));
    setNextFollowupAt(lead.nextFollowupAt);
  }, [lead]);

  function handleSave() {
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      leadStatus,
      temperature: temperature || undefined,
      secondaryPhone: secondaryPhone || undefined,
      tags: tagList,
      nextFollowupAt: nextFollowupAt ?? null,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit lead</Text>

          <ScrollView contentContainerStyle={styles.content}>
            <FieldLabel text="Status" />
            <ChipRow options={STATUSES} value={leadStatus} onChange={(v) => setLeadStatus(v)} />

            <FieldLabel text="Temperature" />
            <ChipRow
              options={TEMPERATURES}
              value={temperature}
              onChange={setTemperature}
              allowEmpty
            />

            <FieldLabel text="Secondary phone" />
            <TextInput
              style={styles.input}
              value={secondaryPhone}
              onChangeText={setSecondaryPhone}
              keyboardType="phone-pad"
              placeholderTextColor={colors.textMutedDark}
              placeholder="Optional"
            />

            <FieldLabel text="Tags" />
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="comma, separated"
              placeholderTextColor={colors.textMutedDark}
            />

            <FieldLabel text="Next follow-up" />
            <FollowUpQuickPicker value={nextFollowupAt} onChange={setNextFollowupAt} />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function ChipRow({
  options,
  value,
  onChange,
  allowEmpty,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <View style={styles.chipRow}>
      {allowEmpty ? (
        <Pressable style={[styles.chip, !value && styles.chipActive]} onPress={() => onChange("")}>
          <Text style={[styles.chipText, !value && styles.chipTextActive]}>None</Text>
        </Pressable>
      ) : null}
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={[styles.chip, value === opt && styles.chipActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.cardDark,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  title: {
    ...typography.subheading,
    color: colors.textDark,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  label: { color: colors.textMutedDark, fontSize: 12, fontWeight: "600", marginTop: 4 },
  input: {
    backgroundColor: colors.backgroundDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    color: colors.textDark,
    padding: spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: {
    color: colors.textMutedDark,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  chipTextActive: { color: "#fff" },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { color: colors.textDark, fontWeight: "600" },
  saveBtn: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700" },
});
