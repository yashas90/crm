import { CallLogModal, type QuickLogPayload, type SubmitOptions } from "@/components/CallLogModal";
import { LeadContactActions } from "@/components/LeadContactActions";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLogCall, useTodayCallSummary, useTodayCalls } from "@/hooks/use-calls";
import { type LeadRow, useTodayQueue } from "@/hooks/use-leads";
import {
  type SiteVisit,
  formatVisitTime,
  useTodaySiteVisits,
  useUpdateSiteVisit,
} from "@/hooks/use-site-visits";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useReturnFromDialerLog } from "@/hooks/useReturnFromDialerLog";
import { callLogSuccessMessage } from "@/lib/call-log-feedback";
import { formatDuration } from "@/lib/dates";
import { dialPhoneNumber } from "@/lib/dialPhone";
import { feedbackCallSaved } from "@/lib/feedback";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useCallback, useMemo, useRef, useState } from "react";
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
  const hour = new Date().getHours();
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
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (date < todayStart) {
    const hours = Math.floor((todayStart.getTime() - date.getTime()) / 3_600_000);
    return hours < 24 ? `Overdue by ${hours}h` : `Overdue by ${Math.floor(hours / 24)}d`;
  }

  return `Follow-up at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function isOverdue(nextFollowupAt: string | null) {
  if (!nextFollowupAt) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return new Date(nextFollowupAt) < todayStart;
}

function isPlannedToday(nextFollowupAt: string | null) {
  if (!nextFollowupAt) return false;
  const date = new Date(nextFollowupAt);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
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
  onMarkComplete: (visitId: string) => void;
  completingVisitId: string | null;
};

function TodayVisitsSection({
  visits,
  isLoading,
  isError,
  onRetry,
  onViewLead,
  onMarkComplete,
  completingVisitId,
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
          <Ionicons name="calendar-outline" size={28} color={colors.textMutedDark} />
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
                    onPress={() => onMarkComplete(visit.id)}
                    disabled={completingVisitId === visit.id}
                  >
                    <Text style={styles.visitCompleteBtnText}>
                      {completingVisitId === visit.id ? "Saving…" : "Mark Complete"}
                    </Text>
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
  const updateVisit = useUpdateSiteVisit();
  const logCall = useLogCall();
  const [completingVisitId, setCompletingVisitId] = useState<string | null>(null);

  const queueItems = queue.data?.items ?? [];
  const recentCalls = (calls.data?.items ?? []).slice(0, 3);
  const [logTarget, setLogTarget] = useState<LeadRow | null>(null);
  const pendingLogLeadRef = useRef<LeadRow | null>(null);
  const insets = useSafeAreaInsets();
  const listBottomPadding = TAB_BAR_SCROLL_PADDING + insets.bottom;

  const [defaultLogDuration, setDefaultLogDuration] = useState(60);
  const [callLoggedToast, setCallLoggedToast] = useState<string | null>(null);

  const openLogForReturn = useCallback((elapsedSeconds: number) => {
    setDefaultLogDuration(elapsedSeconds);
    if (pendingLogLeadRef.current) {
      setLogTarget(pendingLogLeadRef.current);
      pendingLogLeadRef.current = null;
    }
  }, []);

  const { beginCall } = useReturnFromDialerLog(openLogForReturn);

  const logTargetIndex = logTarget ? queueItems.findIndex((item) => item.id === logTarget.id) : -1;
  const hasNextInQueue = logTargetIndex >= 0 && logTargetIndex < queueItems.length - 1;

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

  function handleMarkVisitComplete(visitId: string) {
    setCompletingVisitId(visitId);
    updateVisit.mutate(
      { id: visitId, payload: { status: "completed" } },
      {
        onSuccess: () => void todayVisits.refetch(),
        onError: (err) => {
          Alert.alert("Error", err instanceof Error ? err.message : "Could not update visit.");
        },
        onSettled: () => setCompletingVisitId(null),
      },
    );
  }

  async function handleCall(lead: LeadRow) {
    if (!lead.phone) {
      Alert.alert("No phone", "This lead has no phone number.");
      return;
    }
    pendingLogLeadRef.current = lead;
    const opened = await dialPhoneNumber(lead.phone);
    if (opened) {
      beginCall();
    } else {
      pendingLogLeadRef.current = null;
    }
  }

  function handleLogSubmit(payload: QuickLogPayload, options?: SubmitOptions) {
    if (!logTarget?.phone) return;

    const target = logTarget;
    const nextLead = options?.goNext ? queueItems[logTargetIndex + 1] : null;
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - payload.durationSeconds * 1000);

    logCall.mutate(
      {
        lead_id: target.id,
        phone_number: target.phone ?? "",
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
          await queue.refetch();
          void feedbackCallSaved();
          setCallLoggedToast(callLogSuccessMessage(payload.outcome));
          setTimeout(() => setCallLoggedToast(null), 2500);
          if (options?.goNext && nextLead) {
            setLogTarget(nextLead);
          } else {
            setLogTarget(null);
          }
        },
        onError: (err) => {
          Alert.alert("Error", err instanceof Error ? err.message : "Failed to log call.");
        },
      },
    );
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
        <ActivityIndicator color={colors.primaryLight} />
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
            tintColor={colors.primaryLight}
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
              onLogPress={() => setLogTarget(item)}
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
              completingVisitId={completingVisitId}
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

      <CallLogModal
        visible={Boolean(logTarget)}
        phoneNumber={logTarget?.phone ?? undefined}
        defaultDurationSeconds={defaultLogDuration}
        onClose={() => setLogTarget(null)}
        onSubmit={handleLogSubmit}
        isSubmitting={logCall.isPending}
        showSaveAndNext={hasNextInQueue}
      />

      {callLoggedToast ? (
        <View style={[styles.callLoggedToast, { bottom: 24 + insets.bottom }]}>
          <Text style={styles.callLoggedToastText}>{callLoggedToast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  center: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { paddingHorizontal: spacing.md },
  hero: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: "rgba(20, 184, 166, 0.3)",
  },
  heroGreeting: {
    ...typography.heading,
    color: colors.textDark,
    fontSize: 26,
  },
  heroSub: {
    ...typography.body,
    color: "rgba(248, 250, 252, 0.85)",
    marginTop: spacing.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  chipDanger: { backgroundColor: "rgba(239, 68, 68, 0.2)" },
  chipText: { color: colors.textMutedDark, fontSize: 12, fontWeight: "600" },
  chipTextDanger: { color: "#fca5a5" },
  sectionTitle: {
    ...typography.subheading,
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  sectionTitleFocused: {
    color: colors.primaryLight,
  },
  queueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderDark,
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
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  queueBody: { flex: 1, minWidth: 0 },
  name: { color: colors.textDark, fontSize: 16, fontWeight: "700" },
  subline: { color: colors.textMutedDark, fontSize: 13, marginTop: 2 },
  followUp: { color: colors.textMutedDark, fontSize: 12, marginTop: 4 },
  followUpOverdue: { color: colors.danger, fontWeight: "600" },
  empty: { color: colors.textMutedDark, textAlign: "center", marginTop: 24 },
  recentSection: { marginTop: spacing.lg },
  recentCard: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recentStatus: { color: colors.textDark, fontSize: 13, fontWeight: "600", width: 90 },
  recentMeta: { flex: 1, color: colors.textMutedDark, fontSize: 12, textTransform: "capitalize" },
  recentTime: { color: colors.textMutedDark, fontSize: 12 },
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
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  visitsEmptyText: { color: colors.textMutedDark, textAlign: "center", fontSize: 14 },
  visitsRetryBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
  visitsRetryText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  visitCard: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  visitCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  visitCardBody: { flex: 1, minWidth: 0 },
  visitLeadName: { color: colors.textDark, fontSize: 16, fontWeight: "700" },
  visitMeta: { color: colors.textMutedDark, fontSize: 13, marginTop: 4 },
  visitBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  visitBadgeScheduled: { backgroundColor: "rgba(37, 99, 235, 0.2)" },
  visitBadgeCompleted: { backgroundColor: "rgba(22, 163, 74, 0.2)" },
  visitBadgeMuted: { backgroundColor: "rgba(148, 163, 184, 0.15)" },
  visitBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  visitBadgeTextScheduled: { color: "#93c5fd" },
  visitBadgeTextCompleted: { color: "#86efac" },
  visitBadgeTextMuted: { color: colors.textMutedDark },
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
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.backgroundDark,
  },
  visitViewBtnText: { color: colors.textDark, fontWeight: "600", fontSize: 13 },
});
