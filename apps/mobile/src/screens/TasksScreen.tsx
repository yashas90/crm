import { TaskDetailSheet, isTaskOverdue } from "@/components/TaskDetailSheet";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { type Task, useMyOpenTasks } from "@/hooks/use-tasks";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { LeadsStackParamList, MainTabParamList } from "@/navigation/types";
import { colors, spacing, typography } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/theme/layout";
import { screenStyles } from "@/theme/screen";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CommonActions, type CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "TasksTab">,
  NativeStackScreenProps<LeadsStackParamList>
>;

function TaskListRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const overdue = isTaskOverdue(task);

  return (
    <Pressable style={[screenStyles.listRow, overdue && styles.rowOverdue]} onPress={onPress}>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, overdue && styles.overdueText]}>{task.title}</Text>
        <Text style={[styles.rowMeta, overdue && styles.overdueText]}>
          {task.taskType.replace(/_/g, " ")} · {task.priority}
          {task.dueAt
            ? ` · ${overdue ? "Overdue · " : ""}${new Date(task.dueAt).toLocaleDateString("en-IN")}`
            : ""}
        </Text>
        {task.lead ? (
          <Text style={styles.rowLead}>
            {task.lead.firstName} {task.lead.lastName}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={overdue ? colors.danger : colors.textMuted}
      />
    </Pressable>
  );
}

export function TasksScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch, isRefetching } = useMyOpenTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useRefreshOnFocus(refetch);

  const tasks = data?.items ?? [];
  const openCount = data?.total ?? tasks.length;

  if (isLoading && !data) {
    return (
      <View style={[styles.container, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} testID="tasks-screen-title">
            My tasks
          </Text>
        </View>
        <ListSkeleton rows={5} />
      </View>
    );
  }

  if (isError && !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="tasks-screen-title">
          My tasks
        </Text>
        <Text style={styles.headerSubtitle}>{openCount} open · sorted by due date</Text>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptyText}>No open tasks assigned to you.</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskListRow task={item} onPress={() => setSelectedTaskId(item.id)} />
          )}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      )}

      <TaskDetailSheet
        taskId={selectedTaskId}
        visible={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        onViewLead={(leadId) => {
          setSelectedTaskId(null);
          // Reset Leads stack onto Lead Detail so we don't land on the New/list screen.
          navigation.dispatch(
            CommonActions.navigate({
              name: "LeadsTab",
              params: {
                screen: "LeadDetailScreen",
                params: { leadId, initialTab: "tasks" },
                initial: false,
              },
            }),
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    backgroundColor: colors.sticky,
  },
  headerTitle: { ...typography.heading, color: colors.text, fontSize: 22 },
  headerSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4, fontWeight: "600" },
  list: { padding: spacing.md, gap: spacing.sm },
  rowOverdue: {
    borderColor: colors.danger,
    backgroundColor: "rgba(255, 107, 107, 0.12)",
  },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    textTransform: "capitalize",
  },
  rowLead: { color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: "600" },
  overdueText: { color: colors.danger },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800", textTransform: "uppercase" },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
});
