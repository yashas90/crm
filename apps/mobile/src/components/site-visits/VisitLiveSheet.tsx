import { SignaturePad } from "@/components/site-visits/SignaturePad";
import { uploadDocumentMultipart } from "@/hooks/use-documents";
import {
  type SiteVisit,
  useCreateSiteVisit,
  visitLeadName,
  visitLocation,
} from "@/hooks/use-site-visits";
import { ApiRequestError, apiPost } from "@/lib/apiClient";
import { dialLeadPhone } from "@/lib/leadDialPhone";
import { openLeadWhatsApp } from "@/lib/leadDialPhone";
import { enqueueVisitPayload } from "@/lib/siteVisitOfflineQueue";
import { colors, spacing } from "@/theme";
import {
  FEEDBACK_QUESTIONS,
  OUTCOME_LABELS,
  type VisitOutcome,
  checkInTooEarlyMessage,
  mapsSearchUrl,
  relativeVisitLabel,
  visitTimeSlots,
} from "@propninja/types/site-visit-tracking";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useMemo, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Step = "checkin" | "arrival" | "feedback" | "checkout" | "done" | "reschedule";

const CHECKOUT_OUTCOMES: VisitOutcome[] = [
  "deal_closed",
  "very_interested",
  "interested",
  "needs_time",
  "wants_different_property",
  "not_interested",
];

export function VisitLiveSheet({
  visit,
  visible,
  onClose,
  onChanged,
}: {
  visit: SiteVisit | null;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [step, setStep] = useState<Step>("checkin");
  const [busy, setBusy] = useState(false);
  const [outside, setOutside] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<VisitOutcome>("interested");
  const [reason, setReason] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [celebrate] = useState(() => new Animated.Value(0));
  const createVisit = useCreateSiteVisit();
  const [rescheduleDate, setRescheduleDate] = useState(visit?.visitDate ?? "");
  const [rescheduleTime, setRescheduleTime] = useState("10:00");

  const tooEarly = useMemo(
    () => (visit ? checkInTooEarlyMessage(visit.visitDate, visit.visitTime) : null),
    [visit],
  );

  if (!visit) return null;
  const property = visitLocation(visit);
  const lead = visitLeadName(visit);
  const maps = mapsSearchUrl(
    visit.propertyLat != null ? Number(visit.propertyLat) : null,
    visit.propertyLng != null ? Number(visit.propertyLng) : null,
    visit.propertyAddress,
  );

  async function checkIn(confirmOutside = false) {
    if (!visit) return;
    setBusy(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const position = await Location.getCurrentPositionAsync({});
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }
      const result = await apiPost<{ verified: boolean; message: string | null }>(
        `/api/site-visits/${visit.id}/check-in`,
        { lat, lng, confirmOutside },
      );
      setOutside(null);
      if (result.message) Alert.alert("Check-in", result.message);
      setStep("arrival");
      onChanged();
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "OUTSIDE_ZONE") {
        setOutside(error.message);
        return;
      }
      Alert.alert("Check-in", error instanceof Error ? error.message : "Could not check in");
    } finally {
      setBusy(false);
    }
  }

  async function arrive(customerPresent: "present" | "running_late" | "no_show") {
    if (!visit) return;
    setBusy(true);
    try {
      await apiPost(`/api/site-visits/${visit.id}/arrival`, { customerPresent });
      onChanged();
      setStep(customerPresent === "no_show" ? "reschedule" : "feedback");
    } catch (error) {
      Alert.alert("Arrival", error instanceof Error ? error.message : "Could not update arrival");
    } finally {
      setBusy(false);
    }
  }

  async function addPhotos() {
    const picked = await DocumentPicker.getDocumentAsync({ type: "image/*", multiple: true });
    if (picked.canceled) return;
    const next = [...photos];
    for (const asset of picked.assets) {
      try {
        const body = new FormData();
        body.append("name", asset.name ?? "Visit photo");
        body.append("file", {
          uri: asset.uri,
          name: asset.name ?? "photo.jpg",
          type: asset.mimeType ?? "image/jpeg",
        } as unknown as Blob);
        const uploaded = await uploadDocumentMultipart(body);
        next.push(uploaded.fileUrl);
      } catch {
        next.push(asset.uri);
      }
    }
    setPhotos(next);
  }

  function feedbackBody() {
    return {
      answers: FEEDBACK_QUESTIONS.filter((question) => answers[question.id]).map((question) => ({
        question: question.prompt,
        answer: answers[question.id] ?? "",
        answerType: question.answerType,
      })),
      notes,
      photos,
      signature,
    };
  }

  async function saveFeedback() {
    if (!visit) return;
    const body = feedbackBody();
    if (body.answers.length === 0) {
      Alert.alert("Feedback", "Answer at least the first reaction.");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/api/site-visits/${visit.id}/feedback`, body);
      setStep("checkout");
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "NETWORK_ERROR") {
        await enqueueVisitPayload({ visitId: visit.id, kind: "feedback", body });
        Alert.alert("Saved on this phone", "Feedback will send when you are back online.");
        setStep("checkout");
      } else {
        Alert.alert("Feedback", error instanceof Error ? error.message : "Could not save");
      }
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!visit) return;
    const body = {
      outcome,
      reason: reason || null,
      preferenceNote: outcome === "wants_different_property" ? reason : null,
      nextActionDate: followUp ? new Date(followUp).toISOString() : null,
      signature,
    };
    setBusy(true);
    try {
      await apiPost(`/api/site-visits/${visit.id}/checkout`, body);
      if (outcome === "deal_closed") {
        Animated.sequence([
          Animated.timing(celebrate, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(celebrate, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]).start();
      }
      setStep("done");
      onChanged();
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "NETWORK_ERROR") {
        await enqueueVisitPayload({ visitId: visit.id, kind: "checkout", body });
        Alert.alert("Saved on this phone", "Checkout will send when you are back online.");
        setStep("done");
      } else {
        Alert.alert("Checkout", error instanceof Error ? error.message : "Could not check out");
      }
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (!visit) return;
    try {
      await createVisit.mutateAsync({
        leadId: visit.leadId,
        projectId: visit.projectId,
        visitDate: rescheduleDate,
        visitTime: rescheduleTime,
        propertyAddress: visit.propertyAddress,
        propertyName: visit.propertyName,
        notes: "Rescheduled after no-show",
      });
      onChanged();
      onClose();
    } catch (error) {
      Alert.alert("Reschedule", error instanceof Error ? error.message : "Could not reschedule");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>{property}</Text>
          <Text style={styles.meta}>
            {lead}
            {visit.lead?.leadCode ? ` · ${visit.lead.leadCode}` : ""} ·{" "}
            {relativeVisitLabel(visit.visitDate, visit.visitTime)}
          </Text>
          <Text style={styles.meta}>{visit.propertyAddress ?? "Address not set"}</Text>
          <Text style={styles.meta}>
            Companions: {visit.companions?.replaceAll("_", " ") ?? "—"}
          </Text>
          <View style={styles.row}>
            <Pressable
              style={styles.secondary}
              onPress={() => {
                if (maps) void Linking.openURL(maps);
              }}
            >
              <Text>Get Directions</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              onPress={() => void dialLeadPhone({ leadId: visit.leadId, phone: visit.lead?.phone })}
            >
              <Text>Call Lead</Text>
            </Pressable>
          </View>

          {step === "checkin" ? (
            <View style={styles.block}>
              <Pressable
                style={[styles.primary, tooEarly ? styles.disabled : null]}
                disabled={Boolean(tooEarly) || busy}
                onPress={() => void checkIn(false)}
              >
                <Text style={styles.primaryText}>{tooEarly ?? "Check In"}</Text>
              </Pressable>
              {outside ? (
                <View>
                  <Text style={styles.warn}>{outside}</Text>
                  <Pressable style={styles.primary} onPress={() => void checkIn(true)}>
                    <Text style={styles.primaryText}>Yes I'm here</Text>
                  </Pressable>
                  <Pressable style={styles.secondary} onPress={() => setOutside(null)}>
                    <Text>Wrong location</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === "arrival" ? (
            <View style={styles.block}>
              <Pressable style={styles.primary} onPress={() => void arrive("present")}>
                <Text style={styles.primaryText}>Customer present</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => void arrive("running_late")}>
                <Text>Running late</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => void arrive("no_show")}>
                <Text>No-show</Text>
              </Pressable>
            </View>
          ) : null}

          {step === "feedback" ? (
            <View style={styles.block}>
              {FEEDBACK_QUESTIONS.map((question) => (
                <View key={question.id} style={styles.question}>
                  <Text style={styles.prompt}>
                    {question.id.toUpperCase()} {question.prompt}
                  </Text>
                  <View style={styles.row}>
                    {question.options.map((option) => {
                      const selected = (answers[question.id] ?? "")
                        .split(",")
                        .map((part) => part.trim())
                        .includes(option);
                      return (
                        <Pressable
                          key={option}
                          style={[styles.chip, selected ? styles.chipOn : null]}
                          onPress={() => {
                            if (question.answerType === "multi") {
                              const current = new Set(
                                (answers[question.id] ?? "")
                                  .split(",")
                                  .map((part) => part.trim())
                                  .filter(Boolean),
                              );
                              if (current.has(option)) current.delete(option);
                              else current.add(option);
                              setAnswers({ ...answers, [question.id]: [...current].join(", ") });
                            } else {
                              setAnswers({ ...answers, [question.id]: option });
                            }
                          }}
                        >
                          <Text>{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {question.answerType === "datetime" ? (
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DDTHH:MM"
                      value={answers[question.id] ?? ""}
                      onChangeText={(value) => setAnswers({ ...answers, [question.id]: value })}
                    />
                  ) : null}
                </View>
              ))}
              <Text style={styles.prompt}>Add visit photos</Text>
              <Text style={styles.meta}>
                Camera is not wired. Pick image files. Uploads use the document library when
                allowed; otherwise the photo stays on this phone.
              </Text>
              <Pressable style={styles.secondary} onPress={() => void addPhotos()}>
                <Text>Add visit photos ({photos.length})</Text>
              </Pressable>
              <TextInput
                style={styles.notes}
                multiline
                placeholder="Notes"
                value={notes}
                onChangeText={setNotes}
              />
              <Pressable style={styles.primary} disabled={busy} onPress={() => void saveFeedback()}>
                <Text style={styles.primaryText}>Save feedback</Text>
              </Pressable>
            </View>
          ) : null}

          {step === "checkout" ? (
            <View style={styles.block}>
              {CHECKOUT_OUTCOMES.map((item) => (
                <Pressable key={item} style={styles.secondary} onPress={() => setOutcome(item)}>
                  <Text>
                    {outcome === item ? "• " : ""}
                    {OUTCOME_LABELS[item]}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                style={styles.notes}
                placeholder="Reason or preference note"
                value={reason}
                onChangeText={setReason}
              />
              <TextInput
                style={styles.input}
                placeholder="Follow-up ISO time"
                value={followUp}
                onChangeText={setFollowUp}
              />
              {outcome === "very_interested" || outcome === "negotiating" ? (
                <SignaturePad onChange={setSignature} />
              ) : null}
              <Pressable style={styles.primary} disabled={busy} onPress={() => void checkout()}>
                <Text style={styles.primaryText}>Check out</Text>
              </Pressable>
            </View>
          ) : null}

          {step === "done" ? (
            <View style={styles.block}>
              <Animated.Text style={[styles.title, { opacity: celebrate }]}>
                Deal closed
              </Animated.Text>
              <Text>Visit completed. {OUTCOME_LABELS[outcome]}.</Text>
              {outcome === "deal_closed" ? (
                <Text>Continue the booking in Bookings / TCF. That flow was not rebuilt here.</Text>
              ) : null}
              <Pressable
                style={styles.secondary}
                onPress={() =>
                  void openLeadWhatsApp({
                    leadId: visit.leadId,
                    phone: visit.lead?.phone,
                    leadName: lead,
                    message: `Thank you for visiting ${property}. We will follow up shortly.`,
                  })
                }
              >
                <Text>Share on WhatsApp</Text>
              </Pressable>
            </View>
          ) : null}

          {step === "reschedule" ? (
            <View style={styles.block}>
              <Text>No-show recorded. Call the lead or pick a new slot.</Text>
              <Pressable
                style={styles.secondary}
                onPress={() =>
                  void dialLeadPhone({ leadId: visit.leadId, phone: visit.lead?.phone })
                }
              >
                <Text>Call Lead</Text>
              </Pressable>
              <TextInput
                style={styles.input}
                value={rescheduleDate}
                onChangeText={setRescheduleDate}
              />
              <View style={styles.row}>
                {visitTimeSlots()
                  .slice(0, 8)
                  .map((slot) => (
                    <Pressable
                      key={slot}
                      style={styles.chip}
                      onPress={() => setRescheduleTime(slot)}
                    >
                      <Text>{slot}</Text>
                    </Pressable>
                  ))}
              </View>
              <Pressable style={styles.primary} onPress={() => void reschedule()}>
                <Text style={styles.primaryText}>Reschedule {rescheduleTime}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable style={styles.secondary} onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.md, gap: 8 },
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  meta: { color: colors.textMuted },
  warn: { color: "#b45309" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  block: { gap: 8, marginTop: 8 },
  question: { gap: 6 },
  prompt: { fontWeight: "700", color: colors.text },
  primary: { backgroundColor: colors.primary, borderRadius: 8, padding: 12 },
  primaryText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 },
  disabled: { opacity: 0.5 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipOn: { backgroundColor: "#dbeafe" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    color: colors.text,
  },
  notes: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    minHeight: 80,
    padding: 8,
    color: colors.text,
  },
});
