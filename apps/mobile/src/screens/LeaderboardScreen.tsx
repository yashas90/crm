import { apiGet } from "@/lib/apiClient";
import { colors, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { formatINR } from "@propninja/types/money";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Period = "month" | "quarter" | "year" | "all";
type Scope = "team" | "all" | "branch";

type Row = {
  rank: number;
  agentName: string;
  designation: string | null;
  initials: string;
  totalNr: number;
  targetAchievementPercent: number;
  dealsClosed: number;
  unitsClosed: number;
  trend: "up" | "down" | "flat";
  trendDelta: number;
  badges: { type: string; name: string; tooltip: string }[];
  gapToNext: number;
  gapToTop3: number;
  nameAbove: string | null;
  personalBest: boolean;
};

type Payload = {
  generatedAt: string;
  countdown: { days: number; hours: number };
  announcement: { body: string } | null;
  challenge: { body: string } | null;
  milestone: { message: string } | null;
  personalBest: boolean;
  podium: Row[];
  rows: Row[];
  me: Row;
};

const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
  { id: "all", label: "All" },
];

const SCOPES: { id: Scope; label: string }[] = [
  { id: "team", label: "My Team" },
  { id: "all", label: "All Teams" },
  { id: "branch", label: "My Branch" },
];

function trend(row: Row) {
  if (row.trend === "up") return `⬆️ +${row.trendDelta}`;
  if (row.trend === "down") return `⬇️ -${row.trendDelta}`;
  return "➡️";
}

export function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");
  const [scope, setScope] = useState<Scope>("team");
  const [tip, setTip] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["leaderboard", period, scope],
    queryFn: () => apiGet<Payload>(`/api/leaderboard?period=${period}&scope=${scope}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    meta: { suppressErrorToast: true },
  });

  async function refresh() {
    await queryClient.fetchQuery({
      queryKey: ["leaderboard", period, scope],
      queryFn: () =>
        apiGet<Payload>(`/api/leaderboard?period=${period}&scope=${scope}&refresh=true`),
    });
  }

  const data = query.data;
  const me = data?.me;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: TAB_BAR_SCROLL_PADDING,
      }}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => void refresh()} />
      }
    >
      <Text style={styles.title}>🏆 Leaderboard</Text>
      <Text style={styles.sub}>Rankings update live as deals close</Text>
      {data ? (
        <Text style={styles.meta}>
          Month ends in: {data.countdown.days} days {data.countdown.hours} hrs
        </Text>
      ) : null}
      {data?.announcement ? <Text style={styles.banner}>{data.announcement.body}</Text> : null}
      {data?.challenge ? (
        <Text style={styles.challenge}>Challenge: {data.challenge.body}</Text>
      ) : null}
      {data?.milestone ? <Text style={styles.challenge}>{data.milestone.message}</Text> : null}
      {data?.personalBest ? <Text style={styles.best}>🌟 Personal Best Month!</Text> : null}

      <View style={styles.tabs}>
        {PERIODS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setPeriod(item.id)}
            style={[styles.chip, period === item.id && styles.chipOn]}
          >
            <Text style={period === item.id ? styles.chipOnText : styles.chipText}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.tabs}>
        {SCOPES.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setScope(item.id)}
            style={[styles.chip, scope === item.id && styles.chipOn]}
          >
            <Text style={scope === item.id ? styles.chipOnText : styles.chipText}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {(data?.podium ?? []).map((row) => (
        <View key={`p-${row.rank}`} style={styles.card}>
          <Text style={styles.rank}>
            {row.rank === 1 ? "👑" : row.rank === 2 ? "🥈" : "🥉"} #{row.rank}
          </Text>
          <Text style={styles.name}>
            {row.initials} {row.agentName}
          </Text>
          <Text>
            {formatINR(row.totalNr)} · {row.targetAchievementPercent}% · {row.dealsClosed} deals
          </Text>
        </View>
      ))}
      {(data?.rows ?? []).map((row) => (
        <Pressable
          key={`r-${row.rank}-${row.agentName}`}
          style={styles.card}
          onPress={() => setTip(row.badges[0]?.tooltip ?? null)}
        >
          <Text style={styles.name}>
            #{row.rank} {row.agentName}
          </Text>
          {row.designation ? <Text style={styles.meta}>{row.designation}</Text> : null}
          <Text>
            {formatINR(row.totalNr)} · {row.targetAchievementPercent}%
          </Text>
          <Text style={styles.meta}>
            {row.dealsClosed} deals | {row.unitsClosed} units · {trend(row)}
          </Text>
          {row.nameAbove ? (
            <Text style={styles.meta}>
              {formatINR(row.gapToNext)} to overtake {row.nameAbove}
            </Text>
          ) : null}
        </Pressable>
      ))}
      {tip ? <Text style={styles.meta}>{tip}</Text> : null}
      {me ? (
        <View style={styles.me}>
          <Text style={styles.name}>Your Rank #{me.rank}</Text>
          <Text>
            {formatINR(me.totalNr)} · {me.targetAchievementPercent}%
          </Text>
          {me.nameAbove ? (
            <Text>
              {formatINR(me.gapToNext)} more to overtake {me.nameAbove}
            </Text>
          ) : null}
          {me.rank > 3 ? <Text>{formatINR(me.gapToTop3)} more to reach Top 3</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  title: { ...typography.heading, color: colors.text, fontSize: 24 },
  sub: { color: colors.textMuted, marginBottom: spacing.sm },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  banner: {
    backgroundColor: colors.primary,
    color: "#fff",
    padding: spacing.sm,
    borderRadius: 12,
    marginVertical: spacing.sm,
  },
  challenge: {
    backgroundColor: "#fef3c7",
    padding: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  best: { color: "#047857", fontWeight: "700", marginBottom: spacing.sm },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.sm },
  chip: {
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12 },
  chipOnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rank: { fontSize: 18 },
  name: { fontWeight: "700", color: colors.text, marginTop: 4 },
  me: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
});
