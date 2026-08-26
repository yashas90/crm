import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/theme";
import type { CallOutcome } from "@propninja/types/enums";
import { CALL_OUTCOME_LABELS } from "@propninja/types/enums";
import { Modal, StyleSheet, Text, View } from "react-native";

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
  /** Auto-inferred outcome — not editable by the agent (drives Call Report counts). */
  outcome: CallOutcome;
  onAddNewLead: () => void;
  onLinkExisting: () => void;
  onSkip: () => void;
  busy?: boolean;
};

/**
 * Post-dial-pad sheet. Call result is locked to the auto-detected outcome/duration.
 * Agents only choose whether to link a lead — they cannot change Answered / talk time.
 */
export function PostCallActionModal({
  visible,
  durationSeconds,
  phoneNumber,
  outcome,
  onAddNewLead,
  onLinkExisting,
  onSkip,
  busy,
}: PostCallActionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Call recorded</Text>
          <Text style={styles.subtitle}>
            {phoneNumber} · {formatDuration(durationSeconds)} · {CALL_OUTCOME_LABELS[outcome]}
          </Text>
          <Text style={styles.lockHint}>
            Outcome and duration are recorded automatically from the call. They cannot be edited.
          </Text>

          <Button label="Add as New Lead" onPress={onAddNewLead} disabled={busy} />
          <Button
            label="Link to Existing Lead"
            variant="secondary"
            onPress={onLinkExisting}
            disabled={busy}
            style={{ marginTop: spacing.sm }}
          />
          <Button
            label="Done"
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
  subtitle: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm },
  lockHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
});
