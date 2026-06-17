import { CallLogModal, type QuickLogPayload, type SubmitOptions } from "@/components/CallLogModal";
import { ComplianceChip } from "@/components/ComplianceChip";
import { FollowUpQuickPicker } from "@/components/FollowUpQuickPicker";
import { LeadContactActions } from "@/components/LeadContactActions";
import { LeadEditModal } from "@/components/LeadEditModal";
import { TasksSection } from "@/components/TasksSection";
import { LeadDocumentsSection } from "@/components/documents/LeadDocumentsSection";
import { ScheduleVisitSheet } from "@/components/site-visits/ScheduleVisitSheet";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCalls, useLogCall } from "@/hooks/use-calls";
import {
  type LeadActivity,
  useAddLeadNote,
  useLead,
  useUpdateLead,
  useUpdateLeadFollowUp,
} from "@/hooks/use-leads";
import { formatVisitTime, useLeadSiteVisits } from "@/hooks/use-site-visits";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useReturnFromDialerLog } from "@/hooks/useReturnFromDialerLog";
import {
  getCallConsent,
  getChannelConsent,
  useTcfForLead,
  useUpsertTcfConsent,
} from "@/hooks/useTcf";
import { getCurrentUserId } from "@/lib/auth";
import { callLogSuccessMessage } from "@/lib/call-log-feedback";
import { formatDateTime, formatRelativeTime } from "@/lib/dates";
import { dialPhoneNumber } from "@/lib/dialPhone";
import { feedbackCallSaved } from "@/lib/feedback";
import { scoreBadgeStyle } from "@/lib/leadScore";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useLayoutEffect, useState } from "react";
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

function activityBody(activity: LeadActivity): string {
  const meta = activity.metadata;
  if (meta && typeof meta.text === "string" && meta.text.trim()) return meta.text;
  if (meta && typeof meta.message === "string" && meta.message.trim()) return meta.message;
  return activity.type.replace(/_/g, " ");
}

export function LeadDetailScreen({ route, navigation }: Props) {
  const { leadId } = route.params;
  const { data: lead, isLoading, isError, refetch } = useLead(leadId);
  const { data: tcfData, refetch: refetchTcf } = useTcfForLead(leadId);
  const upsertTcf = useUpsertTcfConsent(leadId);
  const { data: callsData, refetch: refetchCalls } = useCalls({
    lead_id: leadId,
    page: "1",
    pageSize: "20",
  });
  const callConsent = getCallConsent(tcfData);
  const logCall = useLogCall();
  const updateLead = useUpdateLead();
  const updateFollowUp = useUpdateLeadFollowUp(leadId);
  const { data: visitsData, refetch: refetchVisits } = useLeadSiteVisits(leadId);
  const addNote = useAddLeadNote(leadId);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [scheduleVisitVisible, setScheduleVisitVisible] = useState(false);
  const [followUpAt, setFollowUpAt] = useState<string | null>(null);
  const [defaultLogDuration, setDefaultLogDuration] = useState(60);
  const [callLoggedToast, setCallLoggedToast] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [tab, setTab] = useState<"calls" | "notes" | "tasks" | "visits" | "documents">("calls");
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const insets = useSafeAreaInsets();

  const handleReturnFromDialer = useCallback((elapsedSeconds: number) => {
    setDefaultLogDuration(elapsedSeconds);
    setLogModalVisible(true);
  }, []);

  const { beginCall } = useReturnFromDialerLog(handleReturnFromDialer);

  useRefreshOnFocus(() => Promise.all([refetch(), refetchCalls(), refetchTcf()]));

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

  function setCallConsent(consented: boolean) {
    upsertTcf.mutate(
      { consent_type: "call", consented },
      {
        onError: (err) => {
          Alert.alert("Error", err instanceof Error ? err.message : "Failed to update consent.");
        },
      },
    );
  }

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

  function submitLog(payload: QuickLogPayload, _options?: SubmitOptions) {
    if (!lead?.phone) return;

    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - payload.durationSeconds * 1000);

    logCall.mutate(
      {
        lead_id: lead.id,
        phone_number: lead.phone,
        direction: "outgoing",
        duration_seconds: payload.durationSeconds,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        outcome: payload.outcome,
        notes: payload.notes,
        source: "mobile-manual",
      },
      {
        onSuccess: async () => {
          await refetchCalls();
          void feedbackCallSaved();
          setLogModalVisible(false);
          setCallLoggedToast(callLogSuccessMessage(payload.outcome));
          setTimeout(() => setCallLoggedToast(null), 2500);
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
      <ErrorState
        title="Lead not found"
        message="This lead may have been removed or you do not have access."
        onRetry={() => refetch()}
      />
    );
  }

  const summary = lead.leadSummary;
  const scoreStyle = typeof lead.score === "number" ? scoreBadgeStyle(lead.score) : null;

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
          {scoreStyle ? (
            <View style={[styles.scoreChip, { backgroundColor: scoreStyle.bg }]}>
              <Text style={[styles.scoreChipText, { color: scoreStyle.text }]}>
                {scoreStyle.label} · {lead.score}
              </Text>
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
            <Pressable
              onPress={() => lead.secondaryPhone && void dialWithConsentCheck(lead.secondaryPhone)}
              style={styles.infoRow}
            >
              <Text style={styles.infoLabel}>Secondary phone</Text>
              <Text style={styles.infoValue}>{lead.secondaryPhone}</Text>
            </Pressable>
          ) : null}
          {lead.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{lead.email}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Assigned to</Text>
            <View style={styles.assignedRow}>
              <Text style={styles.infoValue}>{lead.assignedUser?.name ?? "Unassigned"}</Text>
              {lead.assignedUser?.id !== getCurrentUserId() ? (
                <Pressable
                  style={styles.claimButton}
                  onPress={() =>
                    updateLead.mutate(
                      { leadId: lead.id, payload: { assignedTo: getCurrentUserId() } },
                      {
                        onError: (err) =>
                          Alert.alert(
                            "Error",
                            err instanceof Error ? err.message : "Failed to assign lead.",
                          ),
                      },
                    )
                  }
                  disabled={updateLead.isPending}
                >
                  <Text style={styles.claimButtonText}>Assign to me</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
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

        <LeadContactActions
          phone={lead.phone}
          leadName={`${lead.firstName} ${lead.lastName}`}
          onCallPress={async () => {
            if (!lead.phone) {
              Alert.alert("No phone number", "This lead does not have a phone number.");
              return;
            }
            await dialWithConsentCheck(lead.phone);
          }}
          onLogPress={() => setLogModalVisible(true)}
        />
        <Text style={styles.callHint}>
          Call opens your SIM dialer. When you return to the app, the call log sheet opens
          automatically.
        </Text>

        <TcfConsentSection
          callConsent={callConsent}
          smsConsent={getChannelConsent(tcfData, "sms")}
          emailConsent={getChannelConsent(tcfData, "email")}
          isSaving={upsertTcf.isPending}
          onSetCallConsent={setCallConsent}
        />

        <View style={styles.summaryRow}>
          <SummaryCard label="Total calls" value={String(summary?.totalCalls ?? 0)} />
          <SummaryCard label="Last contacted" value={formatRelativeTime(lead.lastContactedAt)} />
          <SummaryCard
            label="Next follow-up"
            value={lead.nextFollowupAt ? formatDateTime(lead.nextFollowupAt) : "—"}
          />
        </View>

        <View style={styles.followUpCard}>
          <Text style={styles.followUpTitle}>Schedule follow-up</Text>
          <FollowUpQuickPicker
            value={followUpAt ?? lead.nextFollowupAt}
            onChange={(iso) => {
              setFollowUpAt(iso);
              updateFollowUp.mutate(
                { nextFollowupAt: iso },
                {
                  onError: (err) =>
                    Alert.alert(
                      "Error",
                      err instanceof Error ? err.message : "Failed to update follow-up.",
                    ),
                },
              );
            }}
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
            style={[styles.tab, tab === "tasks" && styles.tabActive]}
            onPress={() => setTab("tasks")}
          >
            <Text style={[styles.tabText, tab === "tasks" && styles.tabTextActive]}>Tasks</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "notes" && styles.tabActive]}
            onPress={() => setTab("notes")}
          >
            <Text style={[styles.tabText, tab === "notes" && styles.tabTextActive]}>Notes</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "visits" && styles.tabActive]}
            onPress={() => setTab("visits")}
          >
            <Text style={[styles.tabText, tab === "visits" && styles.tabTextActive]}>Visits</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "documents" && styles.tabActive]}
            onPress={() => setTab("documents")}
          >
            <Text style={[styles.tabText, tab === "documents" && styles.tabTextActive]}>Docs</Text>
          </Pressable>
        </View>

        {tab === "tasks" ? (
          <TasksSection leadId={leadId} />
        ) : tab === "calls" ? (
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
                  <Text style={styles.callTime}>{formatRelativeTime(call.startedAt)}</Text>
                </View>
              ))
            )}
          </View>
        ) : tab === "notes" ? (
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

            {lead.notes ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteBlockTitle}>Lead notes</Text>
                <Text style={styles.existingNote}>{lead.notes}</Text>
              </View>
            ) : null}

            {(lead.activities ?? []).length > 0 ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteBlockTitle}>Activity</Text>
                {lead.activities!.map((activity) => (
                  <View key={activity.id} style={styles.activityRow}>
                    <Text style={styles.activityMeta}>
                      {activity.userName ?? "Agent"} · {formatRelativeTime(activity.createdAt)}
                    </Text>
                    <Text style={styles.activityText}>{activityBody(activity)}</Text>
                  </View>
                ))}
              </View>
            ) : !lead.notes ? (
              <Text style={styles.empty}>No notes yet.</Text>
            ) : null}
          </View>
        ) : tab === "visits" ? (
          <View style={styles.panel}>
            <Pressable
              style={styles.scheduleVisitBtn}
              onPress={() => setScheduleVisitVisible(true)}
            >
              <Text style={styles.scheduleVisitBtnText}>Schedule visit</Text>
            </Pressable>
            {(visitsData?.items ?? []).length === 0 ? (
              <Text style={styles.empty}>No site visits scheduled.</Text>
            ) : (
              visitsData?.items.map((visit) => (
                <View key={visit.id} style={styles.visitRow}>
                  <Text style={styles.visitTitle}>
                    {visit.visitDate} · {formatVisitTime(visit.visitTime)}
                  </Text>
                  <Text style={styles.visitMeta}>{visit.status}</Text>
                </View>
              ))
            )}
          </View>
        ) : tab === "documents" ? (
          <LeadDocumentsSection
            leadId={leadId}
            leadName={`${lead.firstName} ${lead.lastName}`}
            leadPhone={lead.phone}
          />
        ) : null}
      </ScrollView>

      <CallLogModal
        visible={logModalVisible}
        phoneNumber={lead.phone ?? undefined}
        defaultDurationSeconds={defaultLogDuration}
        onClose={() => setLogModalVisible(false)}
        onSubmit={submitLog}
        isSubmitting={logCall.isPending}
      />

      {callLoggedToast ? (
        <View style={[styles.callLoggedToast, { bottom: 24 + insets.bottom }]}>
          <Text style={styles.callLoggedToastText} testID="call-logged-toast">
            {callLoggedToast}
          </Text>
        </View>
      ) : null}

      <ScheduleVisitSheet
        visible={scheduleVisitVisible}
        leadId={leadId}
        leadName={`${lead.firstName} ${lead.lastName}`}
        leadPhone={lead.phone}
        onClose={() => setScheduleVisitVisible(false)}
        onScheduled={() => {
          void refetchVisits();
        }}
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

function channelStatusLabel(consent: boolean | null) {
  if (consent === true) return { text: "Allowed", color: colors.success };
  if (consent === false) return { text: "Not allowed", color: colors.danger };
  return { text: "Unknown", color: colors.textMutedDark };
}

function TcfConsentSection({
  callConsent,
  smsConsent,
  emailConsent,
  isSaving,
  onSetCallConsent,
}: {
  callConsent: boolean | null;
  smsConsent: boolean | null;
  emailConsent: boolean | null;
  isSaving: boolean;
  onSetCallConsent: (consented: boolean) => void;
}) {
  const sms = channelStatusLabel(smsConsent);
  const email = channelStatusLabel(emailConsent);

  return (
    <View style={styles.consentCard}>
      <Text style={styles.consentTitle}>Consent</Text>
      <Text style={styles.consentSubtitle}>Call consent can be updated from the field.</Text>

      <Text style={styles.consentChannelLabel}>Call</Text>
      <View style={styles.consentActions}>
        <Pressable
          style={[
            styles.consentButton,
            callConsent === true && styles.consentButtonActiveOk,
            isSaving && styles.consentButtonDisabled,
          ]}
          disabled={isSaving}
          onPress={() => onSetCallConsent(true)}
        >
          <Text
            style={[
              styles.consentButtonText,
              callConsent === true && styles.consentButtonTextActiveOk,
            ]}
          >
            OK to call
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.consentButton,
            callConsent === false && styles.consentButtonActiveBlock,
            isSaving && styles.consentButtonDisabled,
          ]}
          disabled={isSaving}
          onPress={() => onSetCallConsent(false)}
        >
          <Text
            style={[
              styles.consentButtonText,
              callConsent === false && styles.consentButtonTextActiveBlock,
            ]}
          >
            Do not call
          </Text>
        </Pressable>
      </View>

      <View style={styles.consentReadRow}>
        <Text style={styles.consentReadLabel}>SMS</Text>
        <Text style={[styles.consentReadValue, { color: sms.color }]}>{sms.text}</Text>
      </View>
      <View style={styles.consentReadRow}>
        <Text style={styles.consentReadLabel}>Email</Text>
        <Text style={[styles.consentReadValue, { color: email.color }]}>{email.text}</Text>
      </View>
    </View>
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
  assignedRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  claimButton: {
    backgroundColor: "rgba(20,184,166,0.15)",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(20,184,166,0.3)",
  },
  claimButtonText: { color: colors.primaryLight, fontSize: 12, fontWeight: "700" },
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
  callHint: {
    color: colors.textMutedDark,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
    marginTop: -4,
  },
  consentCard: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  consentTitle: {
    ...typography.subheading,
    color: colors.textDark,
    fontSize: 16,
  },
  consentSubtitle: {
    color: colors.textMutedDark,
    fontSize: 12,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  consentChannelLabel: {
    color: colors.textMutedDark,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  consentActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  consentButton: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.backgroundDark,
  },
  consentButtonActiveOk: {
    borderColor: "rgba(16, 185, 129, 0.5)",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  consentButtonActiveBlock: {
    borderColor: "rgba(239, 68, 68, 0.5)",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  consentButtonDisabled: { opacity: 0.6 },
  consentButtonText: {
    color: colors.textMutedDark,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  consentButtonTextActiveOk: { color: colors.success },
  consentButtonTextActiveBlock: { color: colors.danger },
  consentReadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  consentReadLabel: { color: colors.textDark, fontSize: 14, fontWeight: "600" },
  consentReadValue: { fontSize: 13, fontWeight: "600" },
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
  callLoggedToast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#166534",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.sm,
    zIndex: 100,
  },
  callLoggedToastText: { color: "#ffffff", fontWeight: "600", fontSize: 14 },
  noteBlock: { marginTop: spacing.md },
  noteBlockTitle: {
    color: colors.textMutedDark,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  existingNote: { color: colors.textDark, fontSize: 14, lineHeight: 20 },
  activityRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  activityMeta: { color: colors.textMutedDark, fontSize: 12, marginBottom: 4 },
  activityText: { color: colors.textDark, fontSize: 14, lineHeight: 20 },
  scoreChip: {
    alignSelf: "flex-start",
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  scoreChipText: { fontSize: 12, fontWeight: "700" },
  followUpCard: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginBottom: spacing.md,
  },
  followUpTitle: {
    color: colors.textDark,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  scheduleVisitBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  scheduleVisitBtnText: { color: "#fff", fontWeight: "700" },
  visitRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  visitTitle: { color: colors.textDark, fontWeight: "600" },
  visitMeta: {
    color: colors.textMutedDark,
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
  },
  errorText: { color: colors.danger },
});
