import { useTodayCallSummary } from "@/hooks/use-calls";
import { useTodayQueue } from "@/hooks/use-leads";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = BottomTabScreenProps<MainTabParamList, "HomeTab">;

export function HomeScreen({ navigation }: Props) {
  const queue = useTodayQueue();
  const summary = useTodayCallSummary();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={[styles.container, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    padding: spacing.lg,
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
