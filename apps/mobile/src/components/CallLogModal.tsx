import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export type QuickLogPayload = {
  disposition: string;
  status: "completed" | "missed" | "rejected" | "failed";
  durationSeconds: number;
  notes?: string;
};

export type SubmitOptions = {
  goNext?: boolean;
};

const OUTCOMES = [
  { label: "Interested", disposition: "interested", status: "completed" as const },
  { label: "Not interested", disposition: "not_interested", status: "completed" as const },
  { label: "Callback", disposition: "callback", status: "completed" as const },
  { label: "No answer", disposition: "no_answer", status: "missed" as const },
  { label: "Wrong number", disposition: "wrong_number", status: "rejected" as const },
];

const NO_ANSWER_INDEX = 3;
const DURATION_PRESETS = [30, 60, 120];

type CallLogModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: QuickLogPayload, options?: SubmitOptions) => void;
  phoneNumber?: string;
  defaultDurationSeconds?: number;
  isSubmitting?: boolean;
  showSaveAndNext?: boolean;
};

export function CallLogModal({
  visible,
  onClose,
  onSubmit,
  phoneNumber,
  defaultDurationSeconds = 60,
  isSubmitting = false,
  showSaveAndNext = false,
}: CallLogModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(String(defaultDurationSeconds));
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const isNoAnswer = selectedOutcome === NO_ANSWER_INDEX;

  useEffect(() => {
    if (visible) {
      setDurationSeconds(String(defaultDurationSeconds));
      setSelectedOutcome(0);
      setShowNotes(false);
      setNotes("");
    }
  }, [visible, defaultDurationSeconds]);

  useEffect(() => {
    if (isNoAnswer) {
      setDurationSeconds("30");
    }
  }, [isNoAnswer]);

  function buildPayload(): QuickLogPayload | null {
    const duration = Number.parseInt(durationSeconds, 10);
    if (Number.isNaN(duration) || duration < 0) return null;

    const outcome = OUTCOMES[selectedOutcome]!;
    return {
      disposition: outcome.disposition,
      status: outcome.status,
      durationSeconds: duration,
      notes: notes.trim() || undefined,
    };
  }

  function handleSave(goNext = false) {
    const payload = buildPayload();
    if (!payload) return;
    onSubmit(payload, goNext ? { goNext: true } : undefined);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Log call outcome</Text>
            {phoneNumber ? <Text style={styles.subtitle}>{phoneNumber}</Text> : null}

            <Text style={styles.label}>Call outcome</Text>
            <View style={styles.chipRow}>
              {OUTCOMES.map((outcome, index) => (
                <Pressable
                  key={outcome.disposition}
                  style={[styles.chip, selectedOutcome === index && styles.chipActive]}
                  onPress={() => setSelectedOutcome(index)}
                >
                  <Text
                    style={[styles.chipText, selectedOutcome === index && styles.chipTextActive]}
                  >
                    {outcome.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {isNoAnswer ? (
              <Text style={styles.hint}>Disposition set to no answer (missed call)</Text>
            ) : null}

            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  style={[
                    styles.durationChip,
                    durationSeconds === String(preset) && styles.chipActive,
                  ]}
                  onPress={() => setDurationSeconds(String(preset))}
                >
                  <Text
                    style={[
                      styles.chipText,
                      durationSeconds === String(preset) && styles.chipTextActive,
                    ]}
                  >
                    {preset}s
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={durationSeconds}
              onChangeText={setDurationSeconds}
              placeholder="Custom seconds"
              placeholderTextColor="#64748b"
            />

            <Pressable onPress={() => setShowNotes((v) => !v)}>
              <Text style={styles.notesToggle}>
                {showNotes ? "Hide notes" : "+ Add notes (optional)"}
              </Text>
            </Pressable>
            {showNotes ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes"
                placeholderTextColor="#64748b"
              />
            ) : null}

            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                onPress={() => handleSave(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.primaryButtonText}>{isSubmitting ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
            {showSaveAndNext ? (
              <Pressable
                style={[styles.nextButton, isSubmitting && styles.buttonDisabled]}
                onPress={() => handleSave(true)}
                disabled={isSubmitting}
              >
                <Text style={styles.nextButtonText}>
                  {isSubmitting ? "Saving..." : "Save & Next"}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "92%",
  },
  content: { padding: 20, gap: 10 },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#94a3b8", marginBottom: 4 },
  label: { color: "#cbd5e1", fontSize: 14, fontWeight: "600", marginTop: 8 },
  hint: { color: "#64748b", fontSize: 12, fontStyle: "italic" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationRow: { flexDirection: "row", gap: 8 },
  chip: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  durationChip: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { color: "#cbd5e1", fontSize: 13 },
  chipTextActive: { color: "#ffffff", fontWeight: "600" },
  input: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    color: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  notesToggle: { color: "#60a5fa", fontSize: 14, marginTop: 4 },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  primaryButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButton: {
    flex: 1,
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  nextButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  secondaryButtonText: { color: "#e2e8f0", fontWeight: "600", fontSize: 16 },
  nextButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  buttonDisabled: { opacity: 0.6 },
});
