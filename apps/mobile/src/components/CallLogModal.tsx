import { colors, radii, shadows, spacing } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { CALL_OUTCOMES, CALL_OUTCOME_LABELS, type CallOutcome } from "@propninja/types/enums";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
  reviewOnly?: boolean;
};

const AUTO_SUBMIT_SECONDS = 8;

const OUTCOME_CHIPS: { value: CallOutcome; label: string; icon: string }[] = [
  { value: "answered", label: "Answered", icon: "checkmark-circle" },
  { value: "no_answer", label: "No Answer", icon: "close-circle" },
  { value: "busy", label: "Busy", icon: "radio-button-off" },
  { value: "left_voicemail", label: "Voicemail", icon: "mic" },
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function CallLogModal({
  visible,
  onClose,
  onSubmit,
  phoneNumber,
  defaultDurationSeconds = 60,
  isSubmitting = false,
  showSaveAndNext = false,
  reviewOnly = false,
}: CallLogModalProps) {
  const [outcome, setOutcome] = useState<CallOutcome>("answered");
  const [durationSeconds, setDurationSeconds] = useState(String(defaultDurationSeconds));
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_SUBMIT_SECONDS);
  const timerTouched = useRef(false);
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setDurationSeconds(String(defaultDurationSeconds));
      setOutcome("answered");
      setShowNotes(false);
      setNotes("");
      setDropdownOpen(false);
      timerTouched.current = false;
      setCountdown(AUTO_SUBMIT_SECONDS);
      progressAnim.setValue(1);
    }
  }, [visible, defaultDurationSeconds, progressAnim]);

  // Auto-submit countdown for reviewOnly mode
  useEffect(() => {
    if (!visible || !reviewOnly) return;

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: AUTO_SUBMIT_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(tick);
          if (!timerTouched.current) {
            onSubmit({ outcome: "answered", durationSeconds: defaultDurationSeconds });
          }
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
      progressAnim.stopAnimation();
    };
  }, [visible, reviewOnly, defaultDurationSeconds, onSubmit, progressAnim]);

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

  function handleOutcomeChipPress(value: CallOutcome) {
    timerTouched.current = true;
    progressAnim.stopAnimation();
    setOutcome(value);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={["bottom"]} style={styles.sheetSafe}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title} testID="call-log-modal-title">
                {reviewOnly ? "Call detected" : "Log call outcome"}
              </Text>
              {phoneNumber ? <Text style={styles.subtitle}>{phoneNumber}</Text> : null}

              {reviewOnly ? (
                <>
                  {/* Duration pill */}
                  <View style={styles.durationPill}>
                    <Ionicons name="time-outline" size={14} color={colors.primary} />
                    <Text style={styles.durationPillText}>
                      {formatDuration(defaultDurationSeconds)}
                    </Text>
                  </View>

                  {/* Outcome chips */}
                  <Text style={styles.label}>How did the call go?</Text>
                  <View style={styles.outcomeChips}>
                    {OUTCOME_CHIPS.map((chip) => (
                      <Pressable
                        key={chip.value}
                        style={[
                          styles.outcomeChip,
                          outcome === chip.value && styles.outcomeChipActive,
                        ]}
                        onPress={() => handleOutcomeChipPress(chip.value)}
                      >
                        <Ionicons
                          name={chip.icon as never}
                          size={15}
                          color={outcome === chip.value ? "#fff" : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.outcomeChipText,
                            outcome === chip.value && styles.outcomeChipTextActive,
                          ]}
                        >
                          {chip.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Notes toggle */}
                  <Pressable
                    onPress={() => {
                      timerTouched.current = true;
                      progressAnim.stopAnimation();
                      setShowNotes((v) => !v);
                    }}
                  >
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
                      placeholder="Optional notes about this call"
                      placeholderTextColor="#64748b"
                    />
                  ) : null}

                  {/* Auto-submit progress bar */}
                  {!timerTouched.current ? (
                    <View style={styles.countdownWrap}>
                      <View style={styles.countdownTrack}>
                        <Animated.View
                          style={[
                            styles.countdownBar,
                            {
                              width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["0%", "100%"],
                              }),
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.countdownText}>
                        Auto-logging as Answered in {countdown}s…
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    <Pressable
                      style={styles.ghostButton}
                      onPress={() => {
                        timerTouched.current = true;
                        progressAnim.stopAnimation();
                        onClose();
                      }}
                    >
                      <Text style={styles.ghostButtonText}>Not a real call</Text>
                    </Pressable>
                    <Pressable
                      testID="call-log-save"
                      style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                      disabled={isSubmitting}
                      onPress={() => {
                        timerTouched.current = true;
                        onSubmit({
                          outcome,
                          durationSeconds: defaultDurationSeconds,
                          notes: notes.trim() || undefined,
                        });
                      }}
                    >
                      <Text style={styles.primaryButtonText}>
                        {isSubmitting ? "Saving…" : "Log Call"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Outcome</Text>
                  <Pressable
                    style={styles.dropdown}
                    onPress={() => setDropdownOpen((open) => !open)}
                  >
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
                          style={[
                            styles.dropdownItem,
                            outcome === value && styles.dropdownItemActive,
                          ]}
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
                      testID="call-log-save"
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
                </>
              )}
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
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.border,
    maxHeight: "100%",
    ...shadows.neu,
  },
  content: { padding: 20, gap: 10 },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  subtitle: { color: colors.textMuted, marginBottom: 4 },
  // duration pill shown in auto-detect mode
  durationPill: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#eff6ff",
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  durationPillText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  // 2×2 outcome chip grid
  outcomeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  outcomeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.card,
    minWidth: "46%",
    ...shadows.cardSm,
  },
  outcomeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  outcomeChipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  outcomeChipTextActive: { color: "#fff", fontWeight: "700" },
  // countdown bar
  countdownWrap: { gap: 6, marginTop: 4 },
  countdownTrack: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  countdownBar: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  countdownText: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  // "Not a real call" ghost link
  ghostButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  ghostButtonText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  label: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 8,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderColor: colors.border,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.card,
    ...shadows.neuSm,
  },
  dropdownText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  dropdownList: {
    borderColor: colors.border,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemActive: { backgroundColor: colors.primary },
  dropdownItemText: { color: colors.textMuted, fontSize: 14 },
  dropdownItemTextActive: { color: "#ffffff", fontWeight: "700" },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationChip: {
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.border },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#ffffff", fontWeight: "700" },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 2,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...shadows.neuSm,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  notesToggle: { color: colors.primary, fontSize: 14, fontWeight: "700", marginTop: 4 },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
    ...shadows.neuSm,
  },
  secondaryButton: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.sticky,
    ...shadows.neuSm,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    ...shadows.neuSm,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
    textTransform: "uppercase",
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
    textTransform: "uppercase",
  },
  nextButtonText: { color: "#ffffff", fontWeight: "800", fontSize: 15, textTransform: "uppercase" },
  buttonDisabled: { opacity: 0.6 },
});
