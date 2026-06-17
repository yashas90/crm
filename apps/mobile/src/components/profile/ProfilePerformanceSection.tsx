import { Button } from "@/components/ui/Button";
import { type AgentStats, useAgentStats } from "@/hooks/use-agent-stats";
import { useIsAgent } from "@/hooks/use-role";
import type { CallDateFilter } from "@/lib/callLogFilters";
import { buildPerformanceShareText } from "@/lib/performanceShare";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";

type ProfilePerformanceSectionProps = {
  onOpenCallLogs: (dateFilter?: CallDateFilter) => void;
};

type TabId = "today" | "month";

function StatRow({
  label,
  value,
  sub,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.statRow}>
      <View style={styles.statRowBody}>
        <Text style={styles.statRowLabel}>{label}</Text>
        {sub ? <Text style={styles.statRowSub}>{sub}</Text> : null}
      </View>
      <Text style={styles.statRowValue}>{value}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMutedDark} /> : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

function CallsChart({ data }: { data: AgentStats["callsLast7Days"] }) {
  const barData = data.map((point) => ({
    value: point.count,
    label: point.date.slice(5),
    frontColor: colors.primaryLight,
  }));

  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>Calls — last 7 days</Text>
      <BarChart
        data={barData}
        barWidth={28}
        spacing={16}
        roundedTop
        hideRules
        xAxisThickness={0}
        yAxisThickness={0}
        yAxisTextStyle={{ color: colors.textMutedDark, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.textMutedDark, fontSize: 10 }}
        noOfSections={3}
        maxValue={Math.max(4, ...barData.map((b) => b.value))}
        height={140}
      />
    </View>
  );
}

function PerformanceBody({
  stats,
  tab,
  showChart,
  onToggleChart,
  onOpenCallLogs,
  isAgent,
}: {
  stats: AgentStats;
  tab: TabId;
  showChart: boolean;
  onToggleChart: () => void;
  onOpenCallLogs: (dateFilter?: CallDateFilter) => void;
  isAgent: boolean;
}) {
  if (tab === "today") {
    const t = stats.today;
    return (
      <View style={styles.panel}>
        <StatRow
          label="Calls Made"
          value={String(t.callsMade)}
          onPress={() => onOpenCallLogs("today")}
        />
        <StatRow
          label="Calls Answered"
          value={String(t.callsAnswered)}
          sub={`${t.callsAnsweredPercent}% of total`}
        />
        <StatRow label="Leads Contacted" value={String(t.leadsContacted)} />
        <StatRow label="Tasks Completed" value={String(t.tasksCompleted)} />
        <StatRow label="New Leads Assigned" value={String(t.newLeadsAssigned)} />
        <StatRow label="Follow-ups Done" value={String(t.followUpsDone)} />
        <Pressable style={styles.chartToggle} onPress={onToggleChart}>
          <Text style={styles.chartToggleText}>
            {showChart ? "Hide chart" : "Show 7-day chart"}
          </Text>
          <Ionicons
            name={showChart ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.primaryLight}
          />
        </Pressable>
        {showChart ? <CallsChart data={stats.callsLast7Days} /> : null}
      </View>
    );
  }

  const m = stats.thisMonth;
  const bestDayLabel = m.bestDay
    ? `${new Date(m.bestDay.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} (${m.bestDay.calls} calls)`
    : "—";

  return (
    <View style={styles.panel}>
      <StatRow label="Total Calls" value={String(m.totalCalls)} />
      <StatRow label="Answered %" value={`${m.answeredPercent}%`} />
      <StatRow label="Avg Call Duration" value={`${m.avgCallDurationMinutes} min`} />
      <StatRow label="Leads Converted (Won)" value={String(m.leadsConverted)} />
      <StatRow
        label="Assigned vs Contacted"
        value={`${m.leadsAssigned} / ${m.leadsContacted}`}
        sub={`${m.leadsAssignedVsContactedRatio}% contacted of assigned`}
      />
      <StatRow label="Tasks" value={`${m.tasksCompleted} done`} sub={`${m.tasksOverdue} overdue`} />
      <StatRow label="Best Day" value={bestDayLabel} />
      {isAgent ? (
        <View style={styles.leaderboard}>
          <Ionicons name="trophy-outline" size={18} color={colors.warning} />
          <Text style={styles.leaderboardText}>
            Your rank: #{stats.leaderboard.rank} of {stats.leaderboard.totalAgents} agents this
            month (calls made)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function ProfilePerformanceSection({ onOpenCallLogs }: ProfilePerformanceSectionProps) {
  const isAgent = useIsAgent();
  const { data, isLoading, isError, refetch, isRefetching } = useAgentStats();
  const [tab, setTab] = useState<TabId>("today");
  const [showChart, setShowChart] = useState(false);

  async function handleShare() {
    if (!data) return;
    await Share.share({ message: buildPerformanceShareText(data) });
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Performance</Text>
        <Button
          label="Share Stats"
          variant="secondary"
          onPress={() => void handleShare()}
          style={styles.shareBtn}
        />
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === "today" && styles.tabActive]}
          onPress={() => setTab("today")}
        >
          <Text style={[styles.tabText, tab === "today" && styles.tabTextActive]}>Today</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "month" && styles.tabActive]}
          onPress={() => setTab("month")}
        >
          <Text style={[styles.tabText, tab === "month" && styles.tabTextActive]}>This Month</Text>
        </Pressable>
      </View>

      {isLoading && !data ? (
        <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
      ) : isError && !data ? (
        <Pressable onPress={() => void refetch()} style={styles.errorBox}>
          <Text style={styles.errorText}>Could not load performance. Tap to retry.</Text>
        </Pressable>
      ) : data ? (
        <PerformanceBody
          stats={data}
          tab={tab}
          showChart={showChart}
          onToggleChart={() => setShowChart((v) => !v)}
          onOpenCallLogs={onOpenCallLogs}
          isAgent={isAgent}
        />
      ) : null}

      {isRefetching ? (
        <ActivityIndicator color={colors.primaryLight} size="small" style={styles.refreshing} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.sm },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMutedDark,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  shareBtn: { paddingHorizontal: spacing.sm, minHeight: 36 },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.cardDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
    alignItems: "center",
  },
  tabActive: {
    borderColor: colors.primaryLight,
    backgroundColor: "rgba(20, 184, 166, 0.12)",
  },
  tabText: { color: colors.textMutedDark, fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: colors.primaryLight },
  panel: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    overflow: "hidden",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  statRowBody: { flex: 1 },
  statRowLabel: { color: colors.textDark, fontSize: 14, fontWeight: "600" },
  statRowSub: { color: colors.textMutedDark, fontSize: 11, marginTop: 2 },
  statRowValue: { color: colors.primaryLight, fontSize: 18, fontWeight: "800" },
  pressed: { opacity: 0.85 },
  chartToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  chartToggleText: { color: colors.primaryLight, fontWeight: "600", fontSize: 13 },
  chartWrap: {
    padding: spacing.md,
    alignItems: "center",
  },
  chartTitle: {
    ...typography.caption,
    color: colors.textMutedDark,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  leaderboard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
  },
  leaderboardText: { flex: 1, color: colors.textDark, fontSize: 13, lineHeight: 20 },
  loader: { marginVertical: spacing.lg },
  errorBox: { padding: spacing.md },
  errorText: { color: colors.danger, textAlign: "center" },
  refreshing: { marginTop: spacing.sm },
});
