import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/theme";
import type { CallOutcome } from "@propninja/types/enums";
import { CALL_OUTCOME_LABELS } from "@propninja/types/enums";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

const OUTCOMES: CallOutcome[] = ["answered", "no_answer", "busy", "left_voicemail"];

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs} sec`;
  return `${mins} min ${secs} sec`;
}

type PostCallActionModalProps = {
  visible: boolean;
  durationSeconds: number;
  phoneNumber: string;
  outcome: CallOutcome;
  onOutcomeChange: (outcome: CallOutcome) => void;
  onAddNewLead: () => void;
  onLinkExisting: () => void;
  onSkip: () => void;
  busy?: boolean;
};

export function PostCallActionModal({
  visible,
  durationSeconds,
  phoneNumber,
  outcome,
  onOutcomeChange,
  onAddNewLead,
  onLinkExisting,
  onSkip,
  busy,
}: PostCallActionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Call ended</Text>
          <Text style={styles.subtitle}>
            {phoneNumber} · Duration: {formatDuration(durationSeconds)}
          </Text>

          <Text style={styles.sectionLabel}>Call result</Text>
          <View style={styles.outcomeRow}>
            {OUTCOMES.map((item) => (
              <Pressable
                key={item}
                style={[styles.outcomeChip, outcome === item && styles.outcomeChipActive]}
                onPress={() => onOutcomeChange(item)}
              >
                <Text
                  style={[styles.outcomeText, outcome === item && styles.outcomeTextActive]}
                  numberOfLines={1}
                >
                  {CALL_OUTCOME_LABELS[item]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button label="Add as New Lead" onPress={onAddNewLead} disabled={busy} />
          <Button
            label="Link to Existing Lead"
            variant="secondary"
            onPress={onLinkExisting}
            disabled={busy}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Skip"
            variant="ghost"
            onPress={onSkip}
            disabled={busy}
            style={{ marginTop: spacing.xs }}
          />
        </View>
      </View>
    </Modal>
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
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.border,
  },
  title: { ...typography.heading, color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  outcomeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  outcomeChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  outcomeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  outcomeText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  outcomeTextActive: { color: "#fff" },
});
