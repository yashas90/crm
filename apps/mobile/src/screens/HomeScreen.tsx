import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCurrentUser } from "@/hooks/use-auth";
import { useTodayCallSummary } from "@/hooks/use-calls";
import { useLeadScopeCounts, useTodayQueue } from "@/hooks/use-leads";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = BottomTabScreenProps<MainTabParamList, "HomeTab">;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen({ navigation }: Props) {
  const { data: user } = useCurrentUser();
  const queue = useTodayQueue();
  const summary = useTodayCallSummary();
  const scope = useLeadScopeCounts();
  const firstName = user?.name?.split(" ")[0] ?? "Agent";

  const refreshAll = () =>
    Promise.all([queue.refetch(), summary.refetch(), scope.refetch()]);

  useRefreshOnFocus(refreshAll);

  const isLoading = queue.isLoading && !queue.data;
  const isError = queue.isError || summary.isError;

  if (isError && !queue.data) {
    return <ErrorState onRetry={refreshAll} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
        refreshControl={
          <RefreshControl
            refreshing={queue.isRefetching || summary.isRefetching}
            onRefresh={refreshAll}
            tintColor={colors.primaryLight}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.greeting}>
            {greeting()}, {firstName}
          </Text>
          <Text style={styles.heroSub}>Here is your pipeline at a glance</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primaryLight} style={{ marginVertical: spacing.xl }} />
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              icon="calendar-outline"
              value={String(queue.data?.total ?? queue.data?.items.length ?? 0)}
              label="Follow-ups due"
              accent={colors.primaryLight}
              onPress={() => navigation.navigate("TodayTab", { focusQueue: true })}
            />
            <StatCard
              icon="call-outline"
              value={String(summary.data?.total_calls ?? 0)}
              label="Calls today"
              accent="#60a5fa"
              onPress={() => navigation.navigate("TodayTab")}
            />
            <StatCard
              icon="people-outline"
              value={String(scope.data?.my ?? scope.data?.all ?? 0)}
              label="My leads"
              accent="#a5b4fc"
              onPress={() => navigation.navigate("LeadsTab")}
            />
            <StatCard
              icon="checkmark-done-outline"
              value={String(summary.data?.completed_calls ?? 0)}
              label="Completed"
              accent="#34d399"
              onPress={() => navigation.navigate("TodayTab")}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actions}>
          <ActionTile
            icon="today-outline"
            label="Today's queue"
            onPress={() => navigation.navigate("TodayTab", { focusQueue: true })}
          />
          <ActionTile
            icon="list-outline"
            label="All leads"
            onPress={() => navigation.navigate("LeadsTab")}
          />
          <ActionTile
            icon="person-add-outline"
            label="New lead"
            onPress={() =>
              navigation.navigate("LeadsTab", {
                screen: "LeadCreateScreen",
              })
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  value,
  label,
  accent,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.statCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={accent} />
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.actionTile}>
      <Ionicons name={icon} size={24} color={colors.primaryLight} />
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMutedDark} />
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  content: { padding: spacing.md },
  hero: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: "rgba(20, 184, 166, 0.35)",
  },
  greeting: { ...typography.heading, color: colors.textDark, fontSize: 26 },
  heroSub: { color: "rgba(248, 250, 252, 0.8)", marginTop: 6, fontSize: 15 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    minWidth: "46%",
  },
  pressed: { opacity: 0.88 },
  statValue: { fontSize: 28, fontWeight: "800", marginTop: 8 },
  statLabel: { color: colors.textMutedDark, fontSize: 13, marginTop: 4 },
  sectionTitle: { ...typography.subheading, color: colors.textDark, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
  actionTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  actionLabel: { flex: 1, color: colors.textDark, fontSize: 16, fontWeight: "600" },
});
