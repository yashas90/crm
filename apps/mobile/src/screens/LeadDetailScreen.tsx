import { CallLogModal, type QuickLogPayload, type SubmitOptions } from "@/components/CallLogModal";
import { ComplianceChip } from "@/components/ComplianceChip";
import { LeadEditModal } from "@/components/LeadEditModal";
import { useCalls, useLogCall } from "@/hooks/use-calls";
import { useAddLeadNote, useLead, useUpdateLead } from "@/hooks/use-leads";
import { useReturnFromDialerLog } from "@/hooks/useReturnFromDialerLog";
import { getCallConsent, useTcfForLead } from "@/hooks/useTcf";
import { dialPhoneNumber } from "@/lib/dialPhone";
import { feedbackCallSaved } from "@/lib/feedback";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadDetailScreen">;

function formatRelative(value: string | null) {
  if (!value) return "Never";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function LeadDetailScreen({ route, navigation }: Props) {
  const { leadId } = route.params;
  const { data: lead, isLoading, isError, refetch } = useLead(leadId);
  const { data: tcfData } = useTcfForLead(leadId);
  const { data: callsData } = useCalls({ lead_id: leadId, page: "1", pageSize: "20" });
  const callConsent = getCallConsent(tcfData);
  const logCall = useLogCall();
  const updateLead = useUpdateLead();
  const addNote = useAddLeadNote(leadId);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [tab, setTab] = useState<"calls" | "notes">("calls");
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const insets = useSafeAreaInsets();

  const { beginCall } = useReturnFromDialerLog(() => setLogModalVisible(true));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setEditVisible(true)}
          hitSlop={8}
          style={{ marginRight: 4 }}
          accessibilityLabel="Edit lead"
        >
          <Ionicons name="pencil" size={22} color="#f8fafc" />
        </Pressable>
      ),
    });
  }, [navigation]);

  async function startDial(phone: string) {
    // Native SIM dialer (tel:) — same API on iOS and Android.
    const opened = await dialPhoneNumber(phone);
    if (opened) beginCall();
  }

  async function dialWithConsentCheck(phone: string) {
    if (callConsent === false) {
      Alert.alert("Do not call", "This lead is marked as Do Not Call. Continue anyway?", [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", style: "destructive", onPress: () => startDial(phone) },
      ]);
      return;
    }

    startDial(phone);
  }

  async function handleCallViaSim() {
    if (!lead?.phone) {
      Alert.alert("No phone number", "This lead does not have a phone number.");
      return;
    }

    await dialWithConsentCheck(lead.phone);
  }

  function submitLog(payload: QuickLogPayload, _options?: SubmitOptions) {
    if (!lead?.phone) return;

    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - payload.durationSeconds * 1000);

    logCall.mutate(
      {
        lead_id: lead.id,
        phone_number: lead.phone,
        direction: "outgoing",
        status: payload.status,
        duration_seconds: payload.durationSeconds,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        disposition: payload.disposition,
        notes: payload.notes,
        source: "mobile-manual",
      },
      {
        onSuccess: () => {
          if (payload.disposition === "callback") {
            const nextFollowupAt = new Date();
            nextFollowupAt.setDate(nextFollowupAt.getDate() + 1);
            updateLead.mutate({
              leadId: lead.id,
              payload: { nextFollowupAt: nextFollowupAt.toISOString() },
            });
          }
          void feedbackCallSaved();
          setLogModalVisible(false);
        },
        onError: (err) => {
          Alert.alert("Error", err instanceof Error ? err.message : "Failed to log call.");
        },
      },
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryLight} />
      </View>
    );
  }

  if (isError || !lead) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Lead not found.</Text>
      </View>
    );
  }

  const summary = lead.leadSummary;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      >
        <View style={styles.profileCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {lead.firstName} {lead.lastName}
            </Text>
            <View style={styles.statusChip}>
              <Text style={styles.statusChipText}>{lead.leadStatus}</Text>
            </View>
          </View>
          <ComplianceChip callConsent={callConsent} />
          {lead.temperature ? (
            <View style={styles.tempChip}>
              <Text style={styles.tempChipText}>{lead.temperature}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => lead.phone && void dialWithConsentCheck(lead.phone)}
            style={styles.infoRow}
          >
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{lead.phone ?? "—"}</Text>
          </Pressable>
          {lead.secondaryPhone ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Secondary phone</Text>
              <Text style={styles.infoValue}>{lead.secondaryPhone}</Text>
            </View>
          ) : null}
          {lead.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{lead.email}</Text>
            </View>
          ) : null}
          {(lead.tags ?? []).length > 0 ? (
            <View style={styles.badgesRow}>
              {lead.tags!.map((tag) => (
                <Badge key={tag} label={tag} />
              ))}
            </View>
          ) : null}

          <View style={styles.badgesRow}>
            {lead.city ? <Badge label={lead.city} /> : null}
            {lead.state ? <Badge label={lead.state} /> : null}
            {lead.leadSource ? <Badge label={lead.leadSource} /> : null}
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={handleCallViaSim}>
          <Text style={styles.primaryButtonText}>Call via SIM</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => setLogModalVisible(true)}>
          <Text style={styles.secondaryButtonText}>Log Last Call</Text>
        </Pressable>

        <View style={styles.summaryRow}>
          <SummaryCard label="Total calls" value={String(summary?.totalCalls ?? 0)} />
          <SummaryCard label="Last contacted" value={formatRelative(lead.lastContactedAt)} />
          <SummaryCard
            label="Next follow-up"
            value={lead.nextFollowupAt ? formatRelative(lead.nextFollowupAt) : "—"}
          />
        </View>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === "calls" && styles.tabActive]}
            onPress={() => setTab("calls")}
          >
            <Text style={[styles.tabText, tab === "calls" && styles.tabTextActive]}>Calls</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "notes" && styles.tabActive]}
            onPress={() => setTab("notes")}
          >
            <Text style={[styles.tabText, tab === "notes" && styles.tabTextActive]}>Notes</Text>
          </Pressable>
        </View>

        {tab === "calls" ? (
          <View style={styles.panel}>
            {(callsData?.items ?? []).length === 0 ? (
              <Text style={styles.empty}>No calls logged yet.</Text>
            ) : (
              callsData?.items.map((call) => (
                <View key={call.id} style={styles.callRow}>
                  <View>
                    <Text style={styles.callTitle}>
                      {call.direction === "incoming" ? "↓ Incoming" : "↑ Outgoing"} · {call.status}
                    </Text>
                    <Text style={styles.callMeta}>
                      {call.disposition ?? "—"} · {call.durationSeconds}s ·{" "}
                      {call.userName ?? "Agent"}
                    </Text>
                  </View>
                  <Text style={styles.callTime}>{formatRelative(call.startedAt)}</Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.panel}>
            <TextInput
              style={styles.noteInput}
              multiline
              placeholder="Add a note..."
              placeholderTextColor={colors.textMutedDark}
              value={noteText}
              onChangeText={setNoteText}
            />
            <Pressable
              style={styles.noteSave}
              disabled={addNote.isPending || !noteText.trim()}
              onPress={() => {
                const text = noteText.trim();
                if (!text) return;
                addNote.mutate(text, {
                  onSuccess: () => {
                    setNoteText("");
                    setNoteSaved(true);
                    setTimeout(() => setNoteSaved(false), 2500);
                  },
                  onError: (err) => {
                    Alert.alert(
                      "Error",
                      err instanceof Error ? err.message : "Failed to save note",
                    );
                  },
                });
              }}
            >
              <Text style={styles.noteSaveText}>
                {addNote.isPending ? "Saving..." : "Save note"}
              </Text>
            </Pressable>
            {noteSaved ? <Text style={styles.noteToast}>Note saved</Text> : null}
            {lead.notes ? <Text style={styles.existingNote}>{lead.notes}</Text> : null}
          </View>
        )}
      </ScrollView>

      <CallLogModal
        visible={logModalVisible}
        phoneNumber={lead.phone ?? undefined}
        onClose={() => setLogModalVisible(false)}
        onSubmit={submitLog}
        isSubmitting={logCall.isPending}
      />

      <LeadEditModal
        visible={editVisible}
        lead={lead}
        isSaving={updateLead.isPending}
        onClose={() => setEditVisible(false)}
        onSave={(payload) => {
          updateLead.mutate(
            { leadId: lead.id, payload },
            {
              onSuccess: async () => {
                setEditVisible(false);
                await refetch();
              },
              onError: (err) => {
                Alert.alert("Error", err instanceof Error ? err.message : "Failed to update lead.");
              },
            },
          );
        }}
      />
    </>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  content: { padding: spacing.md },
  center: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  title: { ...typography.subheading, color: colors.textDark, flexShrink: 1 },
  statusChip: {
    backgroundColor: "rgba(20,184,166,0.15)",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  tempChip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(99,102,241,0.15)",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  tempChipText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  infoRow: { marginBottom: 8 },
  infoLabel: { color: colors.textMutedDark, fontSize: 12, fontWeight: "600" },
  infoValue: { color: colors.textDark, fontSize: 16, marginTop: 2 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  badge: {
    backgroundColor: colors.backgroundDark,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  badgeText: { color: colors.textMutedDark, fontSize: 12 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  secondaryButton: {
    borderColor: colors.borderDark,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  secondaryButtonText: { color: colors.textDark, fontSize: 16, fontWeight: "600" },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  summaryValue: { color: colors.textDark, fontSize: 16, fontWeight: "700" },
  summaryLabel: { color: colors.textMutedDark, fontSize: 11, marginTop: 4 },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: 4,
    marginBottom: spacing.sm,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radii.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMutedDark, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  panel: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  callRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  callTitle: { color: colors.textDark, fontWeight: "600", textTransform: "capitalize" },
  callMeta: { color: colors.textMutedDark, fontSize: 12, marginTop: 2 },
  callTime: { color: colors.textMutedDark, fontSize: 12 },
  empty: { color: colors.textMutedDark, textAlign: "center" },
  noteInput: {
    minHeight: 120,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.sm,
    color: colors.textDark,
    textAlignVertical: "top",
  },
  noteSave: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noteSaveText: { color: "#fff", fontWeight: "600" },
  noteToast: {
    marginTop: spacing.sm,
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: "600",
  },
  existingNote: { color: colors.textMutedDark, marginTop: spacing.sm, fontSize: 14 },
  errorText: { color: colors.danger },
});
