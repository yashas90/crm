import { LeadContactActions } from "@/components/LeadContactActions";
import {
  type UpdateLeadStatusPayload,
  UpdateLeadStatusSheet,
} from "@/components/UpdateLeadStatusSheet";
import { CompleteSiteVisitSheet } from "@/components/site-visits/CompleteSiteVisitSheet";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLogCall, useTodayCallSummary, useTodayCalls } from "@/hooks/use-calls";
import {
  type LeadRow,
  useAddLeadNote,
  useTodayQueue,
  useUpdateLead,
  useUpdateLeadFollowUp,
} from "@/hooks/use-leads";
import { type SiteVisit, formatVisitTime, useTodaySiteVisits } from "@/hooks/use-site-visits";
import { useTeamMembers } from "@/hooks/use-users";
import { useAutoDialerCallLog } from "@/hooks/useAutoDialerCallLog";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { getCurrentUserId, getUser } from "@/lib/auth";
import { formatDuration } from "@/lib/dates";
import { dialPhoneNumber } from "@/lib/dialPhone";
import { feedbackCallSaved } from "@/lib/feedback";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, shadows, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { neuCard, neuSticky } from "@/theme/neubrutal";
import { Ionicons } from "@expo/vector-icons";
import {
  formatDateTimeIst,
  getIstDayBounds,
  getIstHourMinute,
  isBeforeIstDayStart,
  isSameIstCalendarDay,
} from "@propninja/types/ist";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function greeting() {
  const { hour } = getIstHourMinute();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function followUpLabel(nextFollowupAt: string | null) {
  if (!nextFollowupAt) return "No follow-up set";
  const date = new Date(nextFollowupAt);
  const now = new Date();
  const { start: todayStart } = getIstDayBounds(0, now);

  if (date < todayStart) {
    const hours = Math.floor((todayStart.getTime() - date.getTime()) / 3_600_000);
    return hours < 24 ? `Overdue by ${hours}h` : `Overdue by ${Math.floor(hours / 24)}d`;
  }

  return `Follow-up at ${formatDateTimeIst(nextFollowupAt, { hour: "2-digit", minute: "2-digit" })}`;
}

function isOverdue(nextFollowupAt: string | null) {
  if (!nextFollowupAt) return false;
  return isBeforeIstDayStart(nextFollowupAt);
}

function isPlannedToday(nextFollowupAt: string | null) {
  if (!nextFollowupAt) return false;
  return isSameIstCalendarDay(nextFollowupAt, new Date());
}

type Props = BottomTabScreenProps<MainTabParamList, "TodayTab">;

function visitLeadName(visit: SiteVisit) {
  if (visit.lead) {
    return `${visit.lead.firstName} ${visit.lead.lastName}`.trim();
  }
  return "Lead";
}

function visitLocation(visit: SiteVisit) {
  return visit.project?.name ?? visit.propertyAddress ?? visit.propertyLabel ?? "—";
}

function visitStatusStyle(status: SiteVisit["status"]) {
  if (status === "scheduled") {
    return {
      badge: styles.visitBadgeScheduled,
      text: styles.visitBadgeTextScheduled,
      label: "Scheduled",
    };
  }
  if (status === "completed") {
    return {
      badge: styles.visitBadgeCompleted,
      text: styles.visitBadgeTextCompleted,
      label: "Completed",
    };
  }
  return {
    badge: styles.visitBadgeMuted,
    text: styles.visitBadgeTextMuted,
    label: status.replace(/_/g, " "),
  };
}

type TodayVisitsSectionProps = {
  visits: SiteVisit[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onViewLead: (leadId: string) => void;
  onMarkComplete: (visit: SiteVisit) => void;
};

function TodayVisitsSection({
  visits,
  isLoading,
  isError,
  onRetry,
  onViewLead,
  onMarkComplete,
}: TodayVisitsSectionProps) {
  return (
    <View style={styles.visitsSection}>
      <Text style={styles.sectionTitle}>Today's Visits</Text>
      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : isError ? (
        <View style={styles.visitsEmpty}>
          <Text style={styles.visitsEmptyText}>Could not load visits</Text>
          <Pressable style={styles.visitsRetryBtn} onPress={onRetry}>
            <Text style={styles.visitsRetryText}>Retry</Text>
          </Pressable>
        </View>
      ) : visits.length === 0 ? (
        <View style={styles.visitsEmpty}>
          <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
          <Text style={styles.visitsEmptyText}>No site visits scheduled today</Text>
        </View>
      ) : (
        visits.map((visit) => {
          const status = visitStatusStyle(visit.status);
          return (
            <View key={visit.id} style={styles.visitCard}>
              <View style={styles.visitCardHeader}>
                <View style={styles.visitCardBody}>
                  <Text style={styles.visitLeadName}>{visitLeadName(visit)}</Text>
                  <Text style={styles.visitMeta}>
                    {formatVisitTime(visit.visitTime)} · {visitLocation(visit)}
                  </Text>
                </View>
                <View style={[styles.visitBadge, status.badge]}>
                  <Text style={[styles.visitBadgeText, status.text]}>{status.label}</Text>
                </View>
              </View>
              <View style={styles.visitActions}>
                {visit.status === "scheduled" ? (
                  <Pressable
                    style={[styles.visitActionBtn, styles.visitCompleteBtn]}
                    onPress={() => onMarkComplete(visit)}
                  >
                    <Text style={styles.visitCompleteBtnText}>Mark Complete</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.visitActionBtn, styles.visitViewBtn]}
                  onPress={() => onViewLead(visit.leadId)}
                >
                  <Text style={styles.visitViewBtnText}>View Lead</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

export function TodayScreen({ route, navigation }: Props) {
  const focusQueue = route.params?.focusQueue;
  const { data: currentUser } = useCurrentUser();
  const userName = currentUser?.name?.split(" ")[0] ?? "there";
  const queue = useTodayQueue();
  const calls = useTodayCalls();
  const summary = useTodayCallSummary();
  const todayVisits = useTodaySiteVisits();
  const logCall = useLogCall();
  const updateLead = useUpdateLead();
  const [visitToComplete, setVisitToComplete] = useState<SiteVisit | null>(null);

  const queueItems = queue.data?.items ?? [];
  const recentCalls = (calls.data?.items ?? []).slice(0, 3);
  const insets = useSafeAreaInsets();
  const listBottomPadding = TAB_BAR_SCROLL_PADDING + insets.bottom;
  const sessionUser = getUser();
  const teamMembers = useTeamMembers();
  const canReassign = sessionUser?.role === "admin" || sessionUser?.role === "manager";

  const [savedToast, setSavedToast] = useState<string | null>(null);

  const dialerLog = useAutoDialerCallLog({
    logCall: (payload) => logCall.mutateAsync(payload),
    onLogged: async () => {
      await Promise.all([queue.refetch(), calls.refetch(), summary.refetch()]);
      void feedbackCallSaved();
    },
    onLogError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save call.");
    },
  });

  const postCallLeadId = dialerLog.pendingLog?.leadId ?? "";
  const updateFollowUp = useUpdateLeadFollowUp(postCallLeadId);
  const addNote = useAddLeadNote(postCallLeadId);

  const statusLead = dialerLog.pendingLog
    ? (queueItems.find((item) => item.id === dialerLog.pendingLog?.leadId) ?? null)
    : null;

  const { planned, overdue } = useMemo(() => {
    let plannedCount = 0;
    let overdueCount = 0;
    for (const item of queueItems) {
      if (isOverdue(item.nextFollowupAt)) overdueCount += 1;
      else if (isPlannedToday(item.nextFollowupAt)) plannedCount += 1;
    }
    return { planned: plannedCount, overdue: overdueCount };
  }, [queueItems]);

  function openLeadDetail(lead: LeadRow) {
    navigation.navigate("LeadsTab", {
      screen: "LeadDetailScreen",
      params: { leadId: lead.id },
    });
  }

  function openLeadById(leadId: string) {
    navigation.navigate("LeadsTab", {
      screen: "LeadDetailScreen",
      params: { leadId },
    });
  }

  function handleMarkVisitComplete(visit: SiteVisit) {
    setVisitToComplete(visit);
  }

  async function handleCall(lead: LeadRow) {
    if (!lead.phone) {
      Alert.alert("No phone", "This lead has no phone number.");
      return;
    }
    const opened = await dialPhoneNumber(lead.phone);
    if (opened) {
      dialerLog.beginCall({
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName ?? ""}`.trim(),
        phoneNumber: lead.phone,
      });
    }
  }

  async function handleStatusSave(payload: UpdateLeadStatusPayload) {
    const lead = statusLead;
    if (!lead) return;

    const noteText = payload.notes?.trim();
    const afterCall = dialerLog.isPendingLog;

    try {
      const patch: Record<string, unknown> = { leadStatus: payload.leadStatus };
      if (canReassign && payload.assignedTo) {
        patch.assignedTo = payload.assignedTo;
      }

      await updateLead.mutateAsync({ leadId: lead.id, payload: patch });

      if (payload.nextFollowupAt) {
        await updateFollowUp.mutateAsync({ nextFollowupAt: payload.nextFollowupAt });
      }

      if (noteText) {
        await addNote.mutateAsync(noteText);
      }

      await Promise.all([queue.refetch(), calls.refetch(), summary.refetch()]);
      dialerLog.dismissPending();
      setSavedToast(afterCall ? "Call logged · status updated" : "Lead status updated");
      setTimeout(() => setSavedToast(null), 2500);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not update lead.");
    }
  }

  const refreshAll = useCallback(
    () => Promise.all([queue.refetch(), calls.refetch(), summary.refetch(), todayVisits.refetch()]),
    [queue, calls, summary, todayVisits],
  );

  const visitItems = todayVisits.data?.items ?? [];
  const isRefreshing =
    queue.isRefetching || calls.isRefetching || summary.isRefetching || todayVisits.isRefetching;

  useRefreshOnFocus(refreshAll);

  const isLoading = (queue.isLoading || calls.isLoading || summary.isLoading) && !queue.data;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (queue.isError && !queue.data) {
    return (
      <ErrorState
        message={queue.error instanceof Error ? queue.error.message : undefined}
        onRetry={refreshAll}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={queueItems}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshAll}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <Text style={styles.heroGreeting}>
                {greeting()}, {userName}
              </Text>
              <Text style={styles.heroSub}>
                You have {summary.data?.total_calls ?? 0} calls logged today.
              </Text>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Planned calls: {planned}</Text>
                </View>
                <View style={[styles.chip, overdue > 0 && styles.chipDanger]}>
                  <Text style={[styles.chipText, overdue > 0 && styles.chipTextDanger]}>
                    Overdue: {overdue}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={[styles.sectionTitle, focusQueue && styles.sectionTitleFocused]}>
              Call queue ({queue.data?.total ?? queueItems.length})
            </Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>No follow-ups due today. Great work!</Text>}
        renderItem={({ item }) => (
          <View style={styles.queueCard}>
            <Pressable style={styles.queueMain} onPress={() => openLeadDetail(item)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.firstName, item.lastName)}</Text>
              </View>
              <View style={styles.queueBody}>
                <Text style={styles.name}>
                  {item.firstName} {item.lastName}
                </Text>
                <Text style={styles.subline}>
                  {item.phone ?? "No phone"}
                  {item.projectName ? ` · ${item.projectName}` : item.city ? ` · ${item.city}` : ""}
                </Text>
                <Text
                  style={[
                    styles.followUp,
                    isOverdue(item.nextFollowupAt) && styles.followUpOverdue,
                  ]}
                >
                  {followUpLabel(item.nextFollowupAt)}
                </Text>
              </View>
            </Pressable>
            <LeadContactActions
              variant="stack"
              phone={item.phone}
              leadName={`${item.firstName} ${item.lastName}`}
              onCallPress={async () => handleCall(item)}
            />
          </View>
        )}
        ListFooterComponent={
          <>
            <TodayVisitsSection
              visits={visitItems}
              isLoading={todayVisits.isLoading && !todayVisits.data}
              isError={todayVisits.isError && !todayVisits.data}
              onRetry={() => void todayVisits.refetch()}
              onViewLead={openLeadById}
              onMarkComplete={handleMarkVisitComplete}
            />
            {recentCalls.length > 0 ? (
              <View style={styles.recentSection}>
                <Text style={styles.sectionTitle}>Recent calls</Text>
                {recentCalls.map((call) => (
                  <View key={call.id} style={styles.recentCard}>
                    <Text style={styles.recentStatus}>
                      {call.status === "completed" ? "✓" : "○"} {call.status}
                    </Text>
                    <Text style={styles.recentMeta}>
                      {formatDuration(call.durationSeconds)}
                      {call.disposition ? ` · ${call.disposition}` : ""}
                    </Text>
                    <Text style={styles.recentTime}>
                      {new Date(call.startedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ height: 80 }} />
            )}
          </>
        }
      />

      <CompleteSiteVisitSheet
        visible={visitToComplete !== null}
        visit={visitToComplete}
        onClose={() => setVisitToComplete(null)}
        onCompleted={() => void todayVisits.refetch()}
      />

      <UpdateLeadStatusSheet
        visible={dialerLog.isPendingLog}
        currentStatus={statusLead?.leadStatus ?? null}
        defaultAssigneeId={getCurrentUserId()}
        assigneeOptions={canReassign ? (teamMembers.data?.items ?? []) : []}
        isSaving={updateLead.isPending || updateFollowUp.isPending || addNote.isPending}
        onClose={dialerLog.dismissPending}
        onSave={(payload) => void handleStatusSave(payload)}
      />

      {savedToast ? (
        <View style={[styles.callLoggedToast, { bottom: 24 + insets.bottom }]}>
          <Text style={styles.callLoggedToastText}>{savedToast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { paddingHorizontal: spacing.md },
  hero: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...neuSticky,
  },
  heroGreeting: {
    ...typography.heading,
    color: colors.text,
    fontSize: 24,
  },
  heroSub: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontWeight: "500",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.neuSm,
  },
  chipDanger: { backgroundColor: "rgba(255, 107, 107, 0.25)" },
  chipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  chipTextDanger: { color: colors.hot },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionTitleFocused: {
    color: colors.primary,
  },
  queueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...neuCard,
  },
  queueMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  queueBody: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  subline: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  followUp: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  followUpOverdue: { color: colors.danger, fontWeight: "600" },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 24 },
  recentSection: { marginTop: spacing.lg },
  recentCard: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...neuCard,
  },
  recentStatus: { color: colors.text, fontSize: 13, fontWeight: "600", width: 90 },
  recentMeta: { flex: 1, color: colors.textMuted, fontSize: 12, textTransform: "capitalize" },
  recentTime: { color: colors.textMuted, fontSize: 12 },
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
  visitsSection: { marginTop: spacing.lg },
  visitsEmpty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    ...neuCard,
  },
  visitsEmptyText: { color: colors.textMuted, textAlign: "center", fontSize: 14 },
  visitsRetryBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
  visitsRetryText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  visitCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...neuCard,
  },
  visitCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  visitCardBody: { flex: 1, minWidth: 0 },
  visitLeadName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  visitMeta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  visitBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  visitBadgeScheduled: { backgroundColor: "#dbeafe" },
  visitBadgeCompleted: { backgroundColor: "#bbf7d0" },
  visitBadgeMuted: { backgroundColor: "#f5f5f5" },
  visitBadgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  visitBadgeTextScheduled: { color: "#1a3550" },
  visitBadgeTextCompleted: { color: "#166534" },
  visitBadgeTextMuted: { color: colors.textMuted },
  visitActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  visitActionBtn: {
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: "center",
  },
  visitCompleteBtn: { backgroundColor: colors.primary },
  visitCompleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  visitViewBtn: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  visitViewBtnText: { color: colors.text, fontWeight: "600", fontSize: 13 },
});
