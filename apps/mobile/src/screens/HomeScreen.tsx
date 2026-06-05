import { useTodayCallSummary } from "@/hooks/use-calls";
import { useTodayQueue } from "@/hooks/use-leads";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = BottomTabScreenProps<MainTabParamList, "HomeTab">;

export function HomeScreen({ navigation }: Props) {
  const queue = useTodayQueue();
  const summary = useTodayCallSummary();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PropNinja</Text>
      <Text style={styles.subtitle}>Your agent command center</Text>

      <View style={styles.cards}>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate("TodayTab", { focusQueue: true })}
        >
          <Text style={styles.cardValue}>{queue.data?.items.length ?? "—"}</Text>
          <Text style={styles.cardLabel}>Follow-ups due</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate("TodayTab")}
        >
          <Text style={styles.cardValue}>{summary.data?.total_calls ?? "—"}</Text>
          <Text style={styles.cardLabel}>Calls today</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>Tap a card to open Today, or use Leads to call and log.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: { ...typography.heading, color: colors.textDark, fontSize: 28 },
  subtitle: { color: colors.textMutedDark, marginTop: 4, marginBottom: spacing.lg },
  cards: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  card: {
    flex: 1,
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  cardPressed: { opacity: 0.85 },
  cardValue: { color: colors.primaryLight, fontSize: 28, fontWeight: "700" },
  cardLabel: { color: colors.textMutedDark, fontSize: 13, marginTop: 4 },
  hint: { color: colors.textMutedDark, fontSize: 14, lineHeight: 20 },
});
