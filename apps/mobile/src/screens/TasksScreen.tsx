import { TaskDetailSheet, isTaskOverdue } from "@/components/TaskDetailSheet";
import { type Task, useMyOpenTasks } from "@/hooks/use-tasks";
import type { LeadsStackParamList, MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_HEIGHT } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "TasksTab">,
  NativeStackScreenProps<LeadsStackParamList>
>;

function TaskListRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const overdue = isTaskOverdue(task);

  return (
    <Pressable style={[styles.row, overdue && styles.rowOverdue]} onPress={onPress}>
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
        color={overdue ? colors.danger : colors.textMutedDark}
      />
    </Pressable>
  );
}

export function TasksScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useMyOpenTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tasks = data?.items ?? [];

  return (
    <View style={[styles.container, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="tasks-screen-title">
          My tasks
        </Text>
        <Text style={styles.headerSubtitle}>{tasks.length} open · sorted by due date</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primaryLight} style={{ marginTop: spacing.lg }} />
      ) : tasks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-outline" size={48} color={colors.textMutedDark} />
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
          navigation.navigate("LeadsTab", {
            screen: "LeadDetailScreen",
            params: { leadId },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  headerTitle: { ...typography.heading, color: colors.textDark, fontSize: 22 },
  headerSubtitle: { color: colors.textMutedDark, fontSize: 13, marginTop: 4 },
  list: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginBottom: spacing.sm,
  },
  rowOverdue: {
    borderColor: colors.danger,
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.textDark, fontSize: 15, fontWeight: "600" },
  rowMeta: {
    color: colors.textMutedDark,
    fontSize: 12,
    marginTop: 4,
    textTransform: "capitalize",
  },
  rowLead: { color: colors.primaryLight, fontSize: 12, marginTop: 4 },
  overdueText: { color: colors.danger },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.textDark, fontSize: 18, fontWeight: "700" },
  emptyText: { color: colors.textMutedDark, fontSize: 14, textAlign: "center" },
});
