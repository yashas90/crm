import { ComplianceChip } from "@/components/ComplianceChip";
import { FollowUpQuickPicker } from "@/components/FollowUpQuickPicker";
import { LeadContactActions } from "@/components/LeadContactActions";
import { LeadEditModal } from "@/components/LeadEditModal";
import { TasksSection } from "@/components/TasksSection";
import {
  type UpdateLeadStatusPayload,
  UpdateLeadStatusSheet,
} from "@/components/UpdateLeadStatusSheet";
import { WhatsAppTemplateSheet } from "@/components/WhatsAppTemplateSheet";
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
import { useLeadLinkedUnit, useMessageTemplates } from "@/hooks/use-message-templates";
import { formatVisitTime, useLeadSiteVisits } from "@/hooks/use-site-visits";
import { useTeamMembers } from "@/hooks/use-users";
import { useAutoDialerCallLog } from "@/hooks/useAutoDialerCallLog";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import {
  getCallConsent,
  getChannelConsent,
  useTcfForLead,
  useUpsertTcfConsent,
} from "@/hooks/useTcf";
import { getCurrentUserId, getUser } from "@/lib/auth";
import { formatDateTime, formatRelativeTime } from "@/lib/dates";
import { dialPhoneNumber } from "@/lib/dialPhone";
import { feedbackCallSaved } from "@/lib/feedback";
import { scoreBadgeStyle } from "@/lib/leadScore";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, shadows, spacing, typography } from "@/theme";
import { neuCard } from "@/theme/neubrutal";
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
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [scheduleVisitVisible, setScheduleVisitVisible] = useState(false);
  const [followUpAt, setFollowUpAt] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [whatsappSheetVisible, setWhatsappSheetVisible] = useState(false);
  const [tab, setTab] = useState<"calls" | "notes" | "tasks" | "visits" | "documents">("calls");
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const { data: linkedUnit } = useLeadLinkedUnit(leadId);
  const messageTemplates = useMessageTemplates({ enabled: whatsappSheetVisible });
  const sessionUser = getUser();
  const insets = useSafeAreaInsets();
  const teamMembers = useTeamMembers();
  const canReassign = sessionUser?.role === "admin" || sessionUser?.role === "manager";

  const dialerLog = useAutoDialerCallLog({
    logCall: (payload) => logCall.mutateAsync(payload),
    onLogged: async () => {
      await refetchCalls();
      void feedbackCallSaved();
    },
    onLogError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save call.");
    },
  });

  const statusSheetVisible = statusSheetOpen || dialerLog.isPendingLog;

  async function handleStatusSave(payload: UpdateLeadStatusPayload) {
    if (!lead) return;

    const afterCall = dialerLog.isPendingLog;
    const noteText = payload.notes?.trim();
    const noteWithStatus = noteText
      ? `${payload.statusLabel}: ${noteText}`
      : `Status updated to ${payload.statusLabel}`;

    try {
      if (afterCall && dialerLog.pendingLog) {
        await dialerLog.confirmLog("answered", noteWithStatus);
      }

      const patch: Record<string, unknown> = { leadStatus: payload.leadStatus };
      if (canReassign && payload.assignedTo && payload.assignedTo !== lead.assignedUser?.id) {
        patch.assignedTo = payload.assignedTo;
      }

      await updateLead.mutateAsync({ leadId: lead.id, payload: patch });

      if (!afterCall && noteText) {
        await addNote.mutateAsync(noteText);
      }

      await refetch();
      setStatusSheetOpen(false);
      dialerLog.dismissPending();
      setSavedToast("Lead status updated");
      setTimeout(() => setSavedToast(null), 2500);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not update lead.");
    }
  }

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
          <Ionicons name="pencil" size={22} color={colors.text} />
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
    if (!lead) return;
    const opened = await dialPhoneNumber(phone);
    if (opened) {
      dialerLog.beginCall({
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`,
        phoneNumber: phone,
      });
    }
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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
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
          <View style={styles.profileCardInner}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                {lead.firstName} {lead.lastName}
              </Text>
              <View style={styles.statusChip}>
                <Text style={styles.statusChipText}>{lead.leadStatus}</Text>
              </View>
              <Pressable style={styles.changeStatusBtn} onPress={() => setStatusSheetOpen(true)}>
                <Text style={styles.changeStatusBtnText}>Change status</Text>
              </Pressable>
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
                onPress={() =>
                  lead.secondaryPhone && void dialWithConsentCheck(lead.secondaryPhone)
                }
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
          onWhatsAppPress={() => setWhatsappSheetVisible(true)}
        />
        <Text style={styles.callHint}>
          Call opens your SIM dialer. When you return, update the lead status to save the call.
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
              placeholderTextColor={colors.textMuted}
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

      <UpdateLeadStatusSheet
        visible={statusSheetVisible}
        currentStatus={lead.leadStatus}
        currentAssigneeId={lead.assignedUser?.id ?? null}
        defaultAssigneeId={getCurrentUserId()}
        assigneeOptions={canReassign ? (teamMembers.data?.items ?? []) : []}
        isSaving={logCall.isPending || updateLead.isPending || addNote.isPending}
        onClose={() => {
          setStatusSheetOpen(false);
          dialerLog.dismissPending();
        }}
        onSave={(payload) => void handleStatusSave(payload)}
      />

      {savedToast ? (
        <View style={[styles.callLoggedToast, { bottom: 24 + insets.bottom }]}>
          <Text style={styles.callLoggedToastText} testID="lead-status-toast">
            {savedToast}
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

      {lead.phone ? (
        <WhatsAppTemplateSheet
          visible={whatsappSheetVisible}
          phone={lead.phone}
          leadName={`${lead.firstName} ${lead.lastName}`.trim()}
          agentName={sessionUser?.name ?? "PropNinja"}
          projectName={linkedUnit?.projectName ?? lead.projectName}
          unitNumber={linkedUnit?.unitNumber}
          priceListedRs={linkedUnit?.priceListedRs}
          templates={messageTemplates.data?.items ?? []}
          isLoading={messageTemplates.isLoading}
          onClose={() => setWhatsappSheetVisible(false)}
        />
      ) : null}

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
  return { text: "Unknown", color: colors.textMuted };
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    backgroundColor: colors.sticky,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.neu,
  },
  profileCardInner: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  title: { ...typography.subheading, color: colors.text, flexShrink: 1 },
  statusChip: {
    backgroundColor: "#dbeafe",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  changeStatusBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeStatusBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  tempChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.sticky,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  tempChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  infoRow: { marginBottom: 8 },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: { color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 2 },
  assignedRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  claimButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.neuSm,
  },
  claimButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  badge: {
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: colors.border,
  },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  callHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
    marginTop: -4,
  },
  consentCard: {
    ...neuCard,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  consentTitle: {
    ...typography.subheading,
    color: colors.text,
    fontSize: 16,
  },
  consentSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  consentChannelLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
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
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.card,
    ...shadows.neuSm,
  },
  consentButtonActiveOk: {
    borderColor: colors.border,
    backgroundColor: "#dcfce7",
  },
  consentButtonActiveBlock: {
    borderColor: colors.border,
    backgroundColor: "#fee2e2",
  },
  consentButtonDisabled: { opacity: 0.6 },
  consentButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  consentButtonTextActiveOk: { color: colors.success },
  consentButtonTextActiveBlock: { color: colors.danger },
  consentReadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  consentReadLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  consentReadValue: { fontSize: 13, fontWeight: "700" },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: {
    flex: 1,
    ...neuCard,
    padding: spacing.sm,
  },
  summaryValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 4,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.sm,
    ...shadows.neuSm,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radii.sm },
  tabActive: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.border,
  },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  tabTextActive: { color: "#fff", fontWeight: "800" },
  panel: {
    ...neuCard,
    padding: spacing.md,
  },
  callRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  callTitle: { color: colors.text, fontWeight: "700", textTransform: "capitalize" },
  callMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  callTime: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  empty: { color: colors.textMuted, textAlign: "center", fontWeight: "600" },
  noteInput: {
    minHeight: 120,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.sm,
    color: colors.text,
    backgroundColor: colors.card,
    textAlignVertical: "top",
    ...shadows.neuSm,
  },
  noteSave: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadows.neuSm,
  },
  noteSaveText: { color: "#fff", fontWeight: "800" },
  noteToast: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  callLoggedToast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.sm,
    zIndex: 100,
    ...shadows.neu,
  },
  callLoggedToastText: { color: colors.sticky, fontWeight: "800", fontSize: 14 },
  noteBlock: { marginTop: spacing.md },
  noteBlockTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  existingNote: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  activityRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  activityMeta: { color: colors.textMuted, fontSize: 12, marginBottom: 4, fontWeight: "600" },
  activityText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  scoreChip: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  scoreChipText: { fontSize: 12, fontWeight: "800" },
  followUpCard: {
    ...neuCard,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  followUpTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  scheduleVisitBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.neuSm,
  },
  scheduleVisitBtnText: { color: "#fff", fontWeight: "800" },
  visitRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  visitTitle: { color: colors.text, fontWeight: "700" },
  visitMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  errorText: { color: colors.danger, fontWeight: "700" },
});
