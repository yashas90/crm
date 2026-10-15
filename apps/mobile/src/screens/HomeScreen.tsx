import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonBox } from "@/components/ui/Skeleton";
import { useIsAdmin, useIsAgent, useIsManager } from "@/hooks/use-role";
import { apiGet, apiPost } from "@/lib/apiClient";
import { dialPhoneNumber } from "@/lib/phoneActions";
import { queryClient } from "@/lib/queryClient";
import type { MainTabParamList } from "@/navigation/types";
import { useNetwork } from "@/providers/network-provider";
import { colors, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type BriefCallback = {
  id: string;
  source: "lead" | "calling";
  name: string;
  phone: string | null;
  at: string;
  leadId: string | null;
};

type MorningBrief = {
  greeting: string;
  name: string;
  date: string;
  trackingStatus: { on: boolean; label: "On" | "Off"; health: string | null };
  quoteOfDay: { text: string };
  target: {
    achievedLabel: string;
    amountLabel: string;
    dailyNeededLabel: string;
    daysRemaining: number;
    percent: number;
    unlocked: boolean;
    aboveTargetPercent: number;
  };
  teamTarget: {
    memberCount: number;
    targetLabel: string;
    achievedLabel: string;
    aboveTargetCount: number;
  } | null;
  callbacks: { overdue: BriefCallback[]; today: BriefCallback[]; count: number };
  leaderboard: {
    rank: number;
    previousRank: number | null;
    trend: string;
    nameAbove: string | null;
    neighborBelow: { name: string; rank: number } | null;
    gapToNextLabel: string;
  };
  callingData: {
    pending: number;
    calledToday: number;
    interestedToday: number;
    remaining: number;
  };
  leads: {
    hot: number;
    warm: number;
    cold: number;
    siteVisit: number;
    negotiation: number;
    urgent: number;
  };
  teamFeed: {
    items: { id: string; title: string; body: string; reactions: number }[];
    viewAll: { label: string; surface: "whatsapp" | "announcements" };
  };
  schedule: {
    items: {
      id: string;
      timeLabel: string;
      leadName: string;
      projectName: string | null;
      status: string;
      agentName: string | null;
    }[];
  };
  appraisal: {
    quarterLabel: string;
    sales: number;
    units: number;
    minSales: number | null;
    minUnits: number | null;
    hikePercent: number;
    eligible: boolean;
    hikeAmountLabel: string;
    mapped: boolean;
  };
};

type Props = { navigation: BottomTabNavigationProp<MainTabParamList, "HomeTab"> };

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const BlockSkeleton = memo(function BlockSkeleton() {
  return (
    <Card>
      <SkeletonBox height={16} width="40%" />
      <SkeletonBox height={28} width="70%" style={{ marginTop: spacing.sm }} />
      <SkeletonBox height={14} width="90%" style={{ marginTop: spacing.sm }} />
    </Card>
  );
});

const TargetCard = memo(function TargetCard({ brief }: { brief: MorningBrief }) {
  const width = Math.max(0, Math.min(100, brief.target.percent));
  return (
    <Card>
      <Text style={styles.kicker}>This month</Text>
      <Text style={styles.metric}>
        {brief.target.achievedLabel}
        <Text style={styles.metricMuted}> / {brief.target.amountLabel}</Text>
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${width}%` }]} />
      </View>
      <Text style={styles.body}>
        {brief.target.unlocked ? "Unlocked" : "Locked"} · {brief.target.aboveTargetPercent}% above
        target
      </Text>
      <Text style={styles.body}>
        {brief.target.dailyNeededLabel} a day · {brief.target.daysRemaining} days left
      </Text>
    </Card>
  );
});

export function HomeScreen({ navigation }: Props) {
  const isAgent = useIsAgent();
  const isManager = useIsManager();
  const isAdmin = useIsAdmin();
  const { isOnline } = useNetwork();
  const brief = useQuery({
    queryKey: ["morning-brief"],
    queryFn: () => apiGet<MorningBrief>("/api/dashboard/morning-brief"),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const done = useMutation({
    mutationFn: (input: { source: "lead" | "calling"; id: string }) =>
      apiPost("/api/dashboard/morning-brief/callbacks/complete", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["morning-brief"] });
    },
  });

  const data = brief.data;
  const loading = brief.isLoading && !data;
  const minutes = Math.max(0, Math.floor((Date.now() - brief.dataUpdatedAt) / 60_000));

  if (brief.isError && !data) {
    return <ErrorState onRetry={() => void brief.refetch()} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
        refreshControl={
          <RefreshControl
            refreshing={brief.isRefetching}
            onRefresh={() => void brief.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {!isOnline && data && brief.dataUpdatedAt > 0 ? (
          <Text style={styles.offline}>Showing data from {minutes} minutes ago — offline</Text>
        ) : null}

        {loading ? (
          <BlockSkeleton />
        ) : (
          <View>
            <Text style={styles.greeting} testID="home-greeting">
              {data?.greeting}, {data?.name}
            </Text>
            <Text style={styles.sub}>
              {data?.date}
              {data ? ` · Tracking ${data.trackingStatus.label}` : ""}
              {data?.trackingStatus.health ? ` · ${data.trackingStatus.health}` : ""}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Action
            label="Start calling"
            onPress={() => navigation.navigate(isAgent ? "CallingTab" : "DialPadTab")}
          />
          <Action
            label="Add lead"
            onPress={() => navigation.navigate("LeadsTab", { screen: "LeadCreateScreen" })}
          />
          <Action label="Reports" onPress={() => navigation.navigate("ProfileTab")} />
          <Action
            label={isAdmin ? "WhatsApp" : isManager ? "Team" : "Announcements"}
            onPress={() => {
              if (isAdmin) navigation.navigate("ProfileTab");
              else if (isManager) navigation.navigate("TeamTab");
              else navigation.navigate("LeaderboardTab");
            }}
          />
          {isAgent ? (
            <Action label="Request data" onPress={() => navigation.navigate("CallingTab")} />
          ) : null}
          <Action label="Leaderboard" onPress={() => navigation.navigate("LeaderboardTab")} />
        </View>

        <Card>
          {loading ? (
            <SkeletonBox height={48} />
          ) : (
            <Text style={styles.quote}>“{data?.quoteOfDay.text}”</Text>
          )}
        </Card>

        {loading ? <BlockSkeleton /> : data ? <TargetCard brief={data} /> : null}

        {data?.teamTarget ? (
          <Card>
            <Text style={styles.kicker}>Team target</Text>
            <Text style={styles.metric}>
              {data.teamTarget.achievedLabel}
              <Text style={styles.metricMuted}> / {data.teamTarget.targetLabel}</Text>
            </Text>
            <Text style={styles.body}>
              {data.teamTarget.aboveTargetCount} of {data.teamTarget.memberCount} above target
            </Text>
          </Card>
        ) : null}

        <Card>
          <Text style={styles.kicker}>Callbacks{data ? ` · ${data.callbacks.count}` : ""}</Text>
          {loading ? (
            <SkeletonBox height={64} style={{ marginTop: spacing.sm }} />
          ) : data && data.callbacks.count === 0 ? (
            <Text style={styles.body}>No callbacks due today.</Text>
          ) : (
            <>
              <CallbackGroup
                title="Overdue"
                items={data?.callbacks.overdue ?? []}
                busyId={done.isPending ? (done.variables?.id ?? null) : null}
                onDone={(item) => done.mutate({ source: item.source, id: item.id })}
                onOpenLead={(leadId) =>
                  navigation.navigate("LeadsTab", {
                    screen: "LeadDetailScreen",
                    params: { leadId },
                  })
                }
              />
              <CallbackGroup
                title="Today"
                items={data?.callbacks.today ?? []}
                busyId={done.isPending ? (done.variables?.id ?? null) : null}
                onDone={(item) => done.mutate({ source: item.source, id: item.id })}
                onOpenLead={(leadId) =>
                  navigation.navigate("LeadsTab", {
                    screen: "LeadDetailScreen",
                    params: { leadId },
                  })
                }
              />
            </>
          )}
        </Card>

        <Card>
          <Text style={styles.kicker}>Leaderboard</Text>
          {loading || !data ? (
            <SkeletonBox height={48} style={{ marginTop: spacing.sm }} />
          ) : (
            <>
              <Text style={styles.metric}>#{data.leaderboard.rank}</Text>
              <Text style={styles.body}>
                Yesterday #{data.leaderboard.previousRank ?? "—"} · {data.leaderboard.trend}
              </Text>
              <Text style={styles.body}>
                {data.leaderboard.nameAbove
                  ? `${data.leaderboard.gapToNextLabel} behind ${data.leaderboard.nameAbove}`
                  : "You are at the top of this board"}
              </Text>
              {data.leaderboard.neighborBelow ? (
                <Text style={styles.body}>
                  Next behind you: {data.leaderboard.neighborBelow.name} #
                  {data.leaderboard.neighborBelow.rank}
                </Text>
              ) : null}
            </>
          )}
        </Card>

        <Card>
          <Text style={styles.kicker}>Calling data</Text>
          {loading || !data ? (
            <SkeletonBox height={20} style={{ marginTop: spacing.sm }} />
          ) : (
            <Text style={styles.body}>
              {data.callingData.pending} pending · {data.callingData.calledToday} called today ·{" "}
              {data.callingData.interestedToday} interested today · {data.callingData.remaining}{" "}
              remaining
            </Text>
          )}
        </Card>

        <Card>
          <Text style={styles.kicker}>Leads</Text>
          {loading || !data ? (
            <SkeletonBox height={20} style={{ marginTop: spacing.sm }} />
          ) : (
            <Text style={styles.body}>
              {data.leads.hot} hot · {data.leads.warm} warm · {data.leads.cold} cold ·{" "}
              {data.leads.siteVisit} site visit · {data.leads.negotiation} negotiation ·{" "}
              {data.leads.urgent} urgent
            </Text>
          )}
        </Card>

        <Card>
          <Text style={styles.kicker}>Team feed</Text>
          {loading || !data ? (
            <SkeletonBox height={48} style={{ marginTop: spacing.sm }} />
          ) : data.teamFeed.items.length === 0 ? (
            <Text style={styles.body}>Nothing new from the team yet.</Text>
          ) : (
            data.teamFeed.items.map((item) => (
              <View key={item.id} style={styles.feedItem}>
                <Text style={styles.feedTitle}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.meta}>{item.reactions} reactions</Text>
              </View>
            ))
          )}
          <Pressable
            onPress={() => {
              if (isAdmin) navigation.navigate("ProfileTab");
              else if (isManager) navigation.navigate("TeamTab");
              else navigation.navigate("LeaderboardTab");
            }}
          >
            <Text style={styles.link}>{data?.teamFeed.viewAll.label ?? "View full team chat"}</Text>
          </Pressable>
        </Card>

        {loading ? (
          <BlockSkeleton />
        ) : data && data.schedule.items.length > 0 ? (
          <Pressable onPress={() => navigation.navigate("VisitsTab")}>
            <Card>
              <Text style={styles.kicker}>Today&apos;s visits</Text>
              {data.schedule.items.map((visit) => (
                <Text key={visit.id} style={styles.body}>
                  {visit.timeLabel} · {visit.leadName}
                  {visit.projectName ? ` · ${visit.projectName}` : ""} · {visit.status}
                  {visit.agentName ? ` · ${visit.agentName}` : ""}
                </Text>
              ))}
              <Text style={styles.link}>Open today&apos;s visits</Text>
            </Card>
          </Pressable>
        ) : null}

        <Card>
          <Text style={styles.kicker}>Appraisal</Text>
          {loading || !data ? (
            <SkeletonBox height={20} style={{ marginTop: spacing.sm }} />
          ) : (
            <Text style={styles.body}>
              {data.appraisal.quarterLabel}: {data.appraisal.sales} sales / {data.appraisal.units}{" "}
              units
              {data.appraisal.minSales != null
                ? ` (need ${data.appraisal.minSales} / ${data.appraisal.minUnits})`
                : ""}
              . {Math.round(data.appraisal.hikePercent * 100)}% hike{" "}
              {data.appraisal.eligible ? `ready · ${data.appraisal.hikeAmountLabel}` : "not yet"}.
              {data.appraisal.mapped ? "" : " Designation is not on the appraisal sheet."}
            </Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function CallbackGroup({
  title,
  items,
  busyId,
  onDone,
  onOpenLead,
}: {
  title: string;
  items: BriefCallback[];
  busyId: string | null;
  onDone: (item: BriefCallback) => void;
  onOpenLead: (leadId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {items.map((item) => (
        <View key={`${item.source}:${item.id}`} style={styles.row}>
          <Pressable
            style={styles.rowText}
            onPress={() => {
              if (item.leadId) onOpenLead(item.leadId);
            }}
          >
            <Text style={styles.feedTitle}>{item.name}</Text>
            <Text style={styles.meta}>{formatWhen(item.at)}</Text>
          </Pressable>
          {item.phone ? (
            <Pressable onPress={() => void dialPhoneNumber(item.phone!)}>
              <Text style={styles.link}>Call</Text>
            </Pressable>
          ) : null}
          <Pressable disabled={busyId === item.id} onPress={() => onDone(item)}>
            <Text style={styles.link}>Done</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  greeting: { ...typography.h2, color: colors.text },
  sub: { color: colors.textMuted, marginTop: 4 },
  offline: {
    backgroundColor: "#fef3c7",
    color: "#78350f",
    fontWeight: "700",
    padding: spacing.sm,
    borderRadius: 8,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metric: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: spacing.xs },
  metricMuted: { color: colors.textMuted, fontSize: 16, fontWeight: "600" },
  body: { color: colors.text, marginTop: 4, lineHeight: 20 },
  quote: { color: colors.text, fontSize: 16, lineHeight: 22 },
  track: {
    height: 8,
    borderRadius: 99,
    backgroundColor: "#e5e5e5",
    marginTop: spacing.sm,
    overflow: "hidden",
  },
  fill: { height: 8, backgroundColor: colors.primary },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionText: { color: "#fff", fontWeight: "700" },
  group: { marginTop: spacing.sm },
  groupTitle: { color: colors.text, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  rowText: { flex: 1 },
  feedItem: { marginTop: spacing.sm },
  feedTitle: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  link: { color: colors.primary, fontWeight: "700", marginTop: spacing.sm },
});
