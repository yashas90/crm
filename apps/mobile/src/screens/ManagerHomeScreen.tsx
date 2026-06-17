import { RoleGate } from "@/components/RoleGate";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { useLeadScopeCounts } from "@/hooks/use-leads";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { useRole } from "@/hooks/use-role";
import { useTeamOpenTasks, useTeamTasksDueToday } from "@/hooks/use-tasks";
import { useTeamTodayReport } from "@/hooks/use-team-report";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { isForbiddenError } from "@/lib/query-errors";
import type { TeamStackParamList } from "@/navigation/types";
import { useAuth } from "@/providers/auth-provider";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
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

type Props = NativeStackScreenProps<TeamStackParamList, "TeamHomeScreen">;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function TeamHomeContent({ navigation }: Props) {
  const role = useRole();
  const { user } = useAuth();
  const teamReport = useTeamTodayReport();
  const scope = useLeadScopeCounts();
  const tasksDueToday = useTeamTasksDueToday();
  const teamOpenTasks = useTeamOpenTasks();
  const unreadNotifications = useUnreadNotificationCount();

  const firstName = user?.name?.split(" ")[0] ?? role;

  const openTasksByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of teamOpenTasks.data?.items ?? []) {
      if (!task.assignedTo) continue;
      map.set(task.assignedTo, (map.get(task.assignedTo) ?? 0) + 1);
    }
    return map;
  }, [teamOpenTasks.data?.items]);

  const teamCallsToday = useMemo(() => {
    return (teamReport.data?.users ?? []).reduce((sum, u) => sum + u.callsMade, 0);
  }, [teamReport.data?.users]);

  const refreshAll = () =>
    Promise.all([
      teamReport.refetch(),
      scope.refetch(),
      tasksDueToday.refetch(),
      teamOpenTasks.refetch(),
    ]);

  useRefreshOnFocus(refreshAll);

  if (teamReport.isError && isForbiddenError(teamReport.error)) {
    return <ErrorState message="Access denied. Manager or admin role required." />;
  }

  if (teamReport.isError && !teamReport.data) {
    return <ErrorState onRetry={refreshAll} />;
  }

  const isLoading = teamReport.isLoading && !teamReport.data;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
        refreshControl={
          <RefreshControl
            refreshing={teamReport.isRefetching}
            onRefresh={refreshAll}
            tintColor={colors.primaryLight}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={styles.greeting}>
                {greeting()}, {firstName}
              </Text>
              <Text style={styles.heroSub}>Team performance at a glance</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
              onPress={() => navigation.getParent()?.navigate("NotificationsTab")}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.textDark} />
              {unreadNotifications > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primaryLight} style={{ marginVertical: spacing.xl }} />
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              icon="people-outline"
              value={String(scope.data?.all ?? 0)}
              label="Total leads"
              accent="#a5b4fc"
              onPress={() =>
                navigation.getParent()?.navigate("LeadsTab", {
                  screen: "LeadsScreen",
                  params: { scope: "all" },
                })
              }
            />
            <StatCard
              icon="call-outline"
              value={String(teamCallsToday)}
              label="Calls today"
              accent="#60a5fa"
              onPress={() => navigation.navigate("TeamCallLogsScreen")}
            />
            <StatCard
              icon="checkbox-outline"
              value={String(tasksDueToday.data?.total ?? 0)}
              label="Tasks due today"
              accent={colors.warning}
              onPress={() => navigation.getParent()?.navigate("TasksTab")}
            />
            <StatCard
              icon="person-add-outline"
              value={String(scope.data?.unassigned ?? 0)}
              label="Open leads"
              accent={colors.danger}
              onPress={() =>
                navigation.getParent()?.navigate("LeadsTab", {
                  screen: "LeadsScreen",
                  params: { scope: "unassigned" },
                })
              }
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>My team</Text>
        {(teamReport.data?.users ?? []).map((member) => (
          <Card key={member.userId} style={styles.memberCard}>
            <View style={styles.memberHeader}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {member.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberBody}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberEmail}>{member.email}</Text>
              </View>
            </View>
            <View style={styles.memberStats}>
              <MemberStat label="Calls" value={member.callsMade} />
              <MemberStat label="Leads" value={member.leadsAssigned} />
              <MemberStat label="Tasks" value={openTasksByUser.get(member.userId) ?? 0} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function MemberStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.memberStat}>
      <Text style={styles.memberStatValue}>{value}</Text>
      <Text style={styles.memberStatLabel}>{label}</Text>
    </View>
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

export function ManagerHomeScreen(props: Props) {
  return (
    <RoleGate roles={["admin", "manager"]} onGoBack={() => props.navigation.goBack()}>
      <TeamHomeContent {...props} />
    </RoleGate>
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
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  heroText: { flex: 1 },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(248, 250, 252, 0.12)",
  },
  bellBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: colors.textDark, fontSize: 10, fontWeight: "800" },
  greeting: { ...typography.heading, color: colors.textDark, fontSize: 26 },
  heroSub: { color: "rgba(248, 250, 252, 0.8)", marginTop: 6, fontSize: 15 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
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
  memberCard: { marginBottom: spacing.sm, padding: spacing.md },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: { color: "#fff", fontWeight: "700" },
  memberBody: { flex: 1 },
  memberName: { color: colors.textDark, fontSize: 16, fontWeight: "700" },
  memberEmail: { color: colors.textMutedDark, fontSize: 12, marginTop: 2 },
  memberStats: { flexDirection: "row", gap: spacing.sm },
  memberStat: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: "center",
  },
  memberStatValue: { color: colors.primaryLight, fontSize: 18, fontWeight: "800" },
  memberStatLabel: { color: colors.textMutedDark, fontSize: 11, marginTop: 2 },
});
