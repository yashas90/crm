import { Card } from "@/components/ui/Card";
import { apiGet } from "@/lib/apiClient";
import { colors, spacing } from "@/theme";
import { formatINR } from "@propninja/types/money";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text } from "react-native";

type Rank = {
  me: {
    rank: number;
    totalNr: number;
    targetAchievementPercent: number;
    dealsClosed: number;
  };
};

export function MyRankingBlock() {
  const query = useQuery({
    queryKey: ["leaderboard", "month", "team"],
    queryFn: () => apiGet<Rank>("/api/leaderboard?period=month&scope=team"),
    staleTime: 60_000,
    meta: { suppressErrorToast: true },
  });
  const me = query.data?.me;
  return (
    <Card style={styles.card}>
      {me ? (
        <Text style={styles.text}>
          Rank #{me.rank} · {formatINR(me.totalNr)} · {me.targetAchievementPercent}% ·{" "}
          {me.dealsClosed} deals
        </Text>
      ) : (
        <Text style={styles.text}>{query.isError ? "Rank unavailable" : "Loading rank…"}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, padding: spacing.md },
  text: { color: colors.text },
});
