import { CallLogModal } from "@/components/CallLogModal";
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
import { VisitDetailSheet } from "@/components/site-visits/VisitDetailSheet";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCalls, useLogCall } from "@/hooks/use-calls";
import { useLeadBrowser } from "@/hooks/use-lead-browser";
import {
  type LeadActivity,
  useAddLeadNote,
  useLead,
  useUpdateLead,
  useUpdateLeadFollowUp,
} from "@/hooks/use-leads";
import { useLeadLinkedUnit, useMessageTemplates } from "@/hooks/use-message-templates";
import {
  type SiteVisit,
  formatVisitTime,
  useLeadSiteVisits,
  visitLocation,
  visitStatusColor,
  visitStatusLabel,
} from "@/hooks/use-site-visits";
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
import { buildLeadStatusPatch, isNaLeadStatus } from "@/lib/lead-status-options";
import { scoreBadgeStyle } from "@/lib/leadScore";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, shadows, spacing, typography } from "@/theme";
import { neuCard } from "@/theme/neubrutal";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  PanResponder,
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
  const {
    hasNext,
    hasPrevious,
    goToNextLead,
    goToPreviousLead,
    exitAfterNaStatus,
    exitToLeadsList,
    leadIndex,
    leadIds,
    canSwipe,
  } = useLeadBrowser(route, navigation);
  const [isExitingLead, setIsExitingLead] = useState(false);
  const { data: lead, isLoading, isError, refetch } = useLead(leadId, { enabled: !isExitingLead });
  const { data: tcfData, refetch: refetchTcf } = useTcfForLead(leadId);
  const upsertTcf = useUpsertTcfConsent(leadId);
  const { data: callsData, refetch: refetchCalls } = useCalls(
    {
      lead_id: leadId,
      page: "1",
      pageSize: "20",
    },
    { suppressErrorToast: true },
  );
  const callConsent = getCallConsent(tcfData);
  const logCall = useLogCall();
  const updateLead = useUpdateLead();
  const updateFollowUp = useUpdateLeadFollowUp(leadId);
  const { data: visitsData, refetch: refetchVisits } = useLeadSiteVisits(leadId);
  const addNote = useAddLeadNote(leadId);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [statusSheetAfterCall, setStatusSheetAfterCall] = useState(false);
  const [scheduleVisitVisible, setScheduleVisitVisible] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
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
  const canReassign = sessionUser?.role === "admin" || sessionUser?.role === "manager";
  const teamMembers = useTeamMembers({ enabled: canReassign });

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

  const statusSheetVisible = statusSheetOpen;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
          canSwipe &&
          Math.abs(gesture.dx) > 16 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          canSwipe &&
          Math.abs(gesture.dx) > 16 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dx < -56) {
            goToNextLead();
          } else if (gesture.dx > 56) {
            goToPreviousLead();
          }
        },
      }),
    [canSwipe, goToNextLead, goToPreviousLead],
  );

  async function handleStatusSave(payload: UpdateLeadStatusPayload) {
    if (!lead) return;

    const afterCall = statusSheetAfterCall;
    const noteText = payload.notes?.trim();
    const closingLead = isNaLeadStatus(payload.leadStatus);

    try {
      const patch = buildLeadStatusPatch(payload, lead, { canReassign });

      await updateLead.mutateAsync({ leadId: lead.id, payload: patch });

      if (payload.nextFollowupAt) {
        await updateFollowUp.mutateAsync({ nextFollowupAt: payload.nextFollowupAt });
      }

      if (noteText) {
        await addNote.mutateAsync(noteText);
      }

      setStatusSheetOpen(false);
      setStatusSheetAfterCall(false);
      dialerLog.dismissPending();

      if (closingLead) {
        setIsExitingLead(true);
        setSavedToast("Marked not interested · next lead");
        setTimeout(() => setSavedToast(null), 1200);
        exitAfterNaStatus(lead.id);
        return;
      }

      await Promise.all([refetch(), refetchCalls()]);
      setSavedToast(afterCall ? "Call logged · status updated" : "Lead status updated");
      setTimeout(() => setSavedToast(null), 2500);
    } catch (err) {
      setIsExitingLead(false);
      Alert.alert("Error", err instanceof Error ? err.message : "Could not update lead.");
    }
  }

  useRefreshOnFocus(() => {
    if (isExitingLead) return Promise.resolve();
    return Promise.all([refetch(), refetchCalls(), refetchTcf()]);
  });

  useEffect(() => {
    if (isExitingLead || isLoading || lead) return;
    if (isError && hasNext) {
      goToNextLead();
      return;
    }
    if (isError && !hasNext) {
      exitToLeadsList();
    }
  }, [isError, hasNext, isExitingLead, isLoading, lead, goToNextLead, exitToLeadsList]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        leadIds.length > 1 && leadIndex >= 0
          ? `Lead ${leadIndex + 1} of ${leadIds.length}`
          : "Lead detail",
      headerRight: () => (
        <View style={styles.headerActions}>
          {hasPrevious ? (
            <Pressable onPress={() => goToPreviousLead()} hitSlop={8} style={styles.headerNavBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          {hasNext ? (
            <Pressable onPress={() => goToNextLead()} hitSlop={8} style={styles.headerNavBtn}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setEditVisible(true)}
            hitSlop={8}
            style={styles.headerNavBtn}
            accessibilityLabel="Edit lead"
          >
            <Ionicons name="pencil" size={22} color={colors.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, hasNext, hasPrevious, goToNextLead, goToPreviousLead, leadIds.length, leadIndex]);

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

  if (isExitingLead || isLoading) {
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
        message="This lead may have been removed, moved to the NA pool, or you do not have access."
        retryLabel={hasNext ? "Next lead" : "Back to leads"}
        onRetry={() => {
          if (hasNext) {
            goToNextLead();
            return;
          }
          exitToLeadsList();
        }}
      />
    );
  }

  const summary = lead.leadSummary;
  const scoreStyle = typeof lead.score === "number" ? scoreBadgeStyle(lead.score) : null;

  return (
    <>
      <View style={styles.container} {...panResponder.panHandlers}>
        <ScrollView
          style={styles.scroll}
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
            Call opens your SIM dialer. When you return, the call is logged automatically — you can
            optionally update status and schedule a callback.
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

          {linkedUnit ? (
            <Pressable
              style={styles.linkedUnitCard}
              onPress={() =>
                navigation.getParent()?.navigate("ProfileTab", {
                  screen: "ProjectUnitScreen",
                  params: {
                    projectId: linkedUnit.projectId,
                    unitId: linkedUnit.id,
                    unitNumber: linkedUnit.unitNumber,
                  },
                })
              }
            >
              <View style={styles.linkedUnitHeader}>
                <Text style={styles.linkedUnitTitle}>Linked unit</Text>
                <Text style={styles.linkedUnitStatus}>{linkedUnit.status}</Text>
              </View>
              <Text style={styles.linkedUnitProject}>{linkedUnit.projectName}</Text>
              <Text style={styles.linkedUnitMeta}>
                Unit {linkedUnit.unitNumber} · F{linkedUnit.floor} · {linkedUnit.bedrooms} BHK
              </Text>
              {linkedUnit.bookingDocument?.bookingRef ? (
                <Text style={styles.linkedUnitRef}>{linkedUnit.bookingDocument.bookingRef}</Text>
              ) : null}
            </Pressable>
          ) : null}

          <View style={styles.followUpCard}>
            <Text style={styles.followUpTitle}>Schedule follow-up</Text>
            <FollowUpQuickPicker
              value={followUpAt ?? lead.nextFollowupAt}
              onChange={(iso) => {
                setFollowUpAt(iso);
                updateFollowUp.mutate(
                  { nextFollowupAt: iso as string },
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
              <Text style={[styles.tabText, tab === "documents" && styles.tabTextActive]}>
                Docs
              </Text>
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
                        {call.direction === "incoming" ? "↓ Incoming" : "↑ Outgoing"} ·{" "}
                        {call.status}
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
                visitsData?.items.map((visit) => {
                  const statusColor = visitStatusColor(visit.status);
                  return (
                    <Pressable
                      key={visit.id}
                      style={styles.visitRow}
                      onPress={() => setSelectedVisit(visit)}
                    >
                      <View style={styles.visitRowHeader}>
                        <Text style={styles.visitTitle}>
                          {visit.visitDate} · {formatVisitTime(visit.visitTime)}
                        </Text>
                        <View
                          style={[styles.visitStatusBadge, { backgroundColor: `${statusColor}22` }]}
                        >
                          <Text style={[styles.visitStatusText, { color: statusColor }]}>
                            {visitStatusLabel(visit.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.visitMeta}>{visitLocation(visit)}</Text>
                    </Pressable>
                  );
                })
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
        {canSwipe ? (
          <View style={[styles.swipeHint, { bottom: 12 + insets.bottom }]}>
            <Ionicons name="arrow-back" size={14} color={colors.textMuted} />
            <Text style={styles.swipeHintText}>Swipe for prev / next lead</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
          </View>
        ) : null}
      </View>

      {dialerLog.isPendingLog && dialerLog.pendingLog ? (
        <CallLogModal
          visible
          reviewOnly
          phoneNumber={dialerLog.pendingLog.phoneNumber}
          defaultDurationSeconds={dialerLog.pendingLog.durationSeconds}
          isSubmitting={logCall.isPending}
          onClose={dialerLog.dismissPending}
          onSubmit={(payload) => {
            void (async () => {
              try {
                await dialerLog.confirmLog(payload.outcome, payload.notes, payload.ringSeconds);
                setStatusSheetAfterCall(true);
                setStatusSheetOpen(true);
              } catch {
                // onLogError surfaces the failure
              }
            })();
          }}
        />
      ) : null}

      <UpdateLeadStatusSheet
        visible={statusSheetVisible}
        currentStatus={lead.leadStatus}
        currentAssigneeId={lead.assignedUser?.id ?? null}
        defaultAssigneeId={lead.assignedUser?.id ?? getCurrentUserId()}
        assigneeOptions={canReassign ? (teamMembers.data?.items ?? []) : []}
        isSaving={updateLead.isPending || updateFollowUp.isPending || addNote.isPending}
        onClose={() => {
          setStatusSheetOpen(false);
          setStatusSheetAfterCall(false);
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

      <VisitDetailSheet
        visit={selectedVisit}
        visible={Boolean(selectedVisit)}
        onClose={() => setSelectedVisit(null)}
        onCompleted={() => void refetchVisits()}
      />

      {lead.phone ? (
        <WhatsAppTemplateSheet
          visible={whatsappSheetVisible}
          phone={lead.phone}
          leadName={`${lead.firstName} ${lead.lastName}`.trim()}
          agentName={sessionUser?.name ?? "PropNinja"}
          projectName={linkedUnit?.projectName ?? lead.projectName}
          unitNumber={linkedUnit?.unitNumber}
          priceListedRs={
            linkedUnit?.priceListedRs != null ? String(linkedUnit.priceListedRs) : undefined
          }
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
  scroll: { flex: 1 },
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
  linkedUnitCard: {
    ...neuCard,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  linkedUnitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  linkedUnitTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  linkedUnitStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  linkedUnitProject: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  linkedUnitMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  linkedUnitRef: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: spacing.xs,
    fontFamily: "monospace",
  },
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
    gap: 4,
  },
  visitRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  visitStatusBadge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  visitStatusText: { fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  visitTitle: { color: colors.text, fontWeight: "700", flex: 1 },
  visitMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  errorText: { color: colors.danger, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4, marginRight: 4 },
  headerNavBtn: { padding: 4 },
  swipeHint: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.neuSm,
  },
  swipeHintText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
});
