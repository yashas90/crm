import { Ionicons } from "@expo/vector-icons";
import { CALL_OUTCOMES, CALL_OUTCOME_LABELS, type CallOutcome } from "@propninja/types/enums";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type QuickLogPayload = {
  outcome: CallOutcome;
  durationSeconds: number;
  notes?: string;
};

export type SubmitOptions = {
  goNext?: boolean;
};

const DURATION_PRESETS = [30, 60, 120, 300];

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
  const [outcome, setOutcome] = useState<CallOutcome>("answered");
  const [durationSeconds, setDurationSeconds] = useState(String(defaultDurationSeconds));
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setDurationSeconds(String(defaultDurationSeconds));
      setOutcome("answered");
      setShowNotes(false);
      setNotes("");
      setDropdownOpen(false);
    }
  }, [visible, defaultDurationSeconds]);

  function buildPayload(): QuickLogPayload | null {
    const duration = Number.parseInt(durationSeconds, 10);
    if (Number.isNaN(duration) || duration < 0) return null;

    return {
      outcome,
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
        <SafeAreaView edges={["bottom"]} style={styles.sheetSafe}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title}>Log call outcome</Text>
              {phoneNumber ? <Text style={styles.subtitle}>{phoneNumber}</Text> : null}

              <Text style={styles.label}>Outcome</Text>
              <Pressable style={styles.dropdown} onPress={() => setDropdownOpen((open) => !open)}>
                <Text style={styles.dropdownText}>{CALL_OUTCOME_LABELS[outcome]}</Text>
                <Ionicons
                  name={dropdownOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#94a3b8"
                />
              </Pressable>
              {dropdownOpen ? (
                <View style={styles.dropdownList}>
                  {CALL_OUTCOMES.map((value) => (
                    <Pressable
                      key={value}
                      style={[styles.dropdownItem, outcome === value && styles.dropdownItemActive]}
                      onPress={() => {
                        setOutcome(value);
                        setDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          outcome === value && styles.dropdownItemTextActive,
                        ]}
                      >
                        {CALL_OUTCOME_LABELS[value]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
                      {preset < 60 ? `${preset}s` : `${Math.round(preset / 60)}m`}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={durationSeconds}
                onChangeText={setDurationSeconds}
                placeholder="Duration in seconds"
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
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? "Saving..." : "Save"}
                  </Text>
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
        </SafeAreaView>
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
  sheetSafe: {
    maxHeight: "92%",
  },
  sheet: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "100%",
  },
  content: { padding: 20, gap: 10 },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#94a3b8", marginBottom: 4 },
  label: { color: "#cbd5e1", fontSize: 14, fontWeight: "600", marginTop: 8 },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#0f172a",
  },
  dropdownText: { color: "#f8fafc", fontSize: 15 },
  dropdownList: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#0f172a",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  dropdownItemActive: { backgroundColor: "#1d4ed8" },
  dropdownItemText: { color: "#cbd5e1", fontSize: 14 },
  dropdownItemTextActive: { color: "#ffffff", fontWeight: "600" },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
