import {
  type Task,
  type TaskType,
  useCompleteTask,
  useCreateTask,
  useLeadTasks,
} from "@/hooks/use-tasks";
import { formatRelativeTime } from "@/lib/dates";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const TASK_TYPES: { value: TaskType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "follow_up", label: "Follow-up", icon: "chatbubble-outline" },
  { value: "call", label: "Call", icon: "call-outline" },
  { value: "meeting", label: "Meeting", icon: "people-outline" },
  { value: "site_visit", label: "Site visit", icon: "location-outline" },
  { value: "document", label: "Document", icon: "document-outline" },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#64748b",
};

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const isDone = task.status === "completed" || task.status === "cancelled";
  const isOverdue = !isDone && task.dueAt && new Date(task.dueAt) < new Date();
  const priorityColor = PRIORITY_COLORS[task.priority] ?? colors.textMutedDark;

  return (
    <View style={[styles.taskRow, isDone && styles.taskRowDone]}>
      <Pressable
        style={[styles.checkbox, isDone && styles.checkboxDone]}
        onPress={() => !isDone && onComplete(task.id)}
        hitSlop={8}
      >
        {isDone ? <Ionicons name="checkmark" size={14} color={colors.success} /> : null}
      </Pressable>

      <View style={styles.taskBody}>
        <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>{task.title}</Text>
        <View style={styles.taskMeta}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={styles.taskMetaText}>{task.taskType.replace(/_/g, " ")}</Text>
          {task.dueAt ? (
            <Text style={[styles.taskMetaText, isOverdue && styles.overdue]}>
              · {isOverdue ? "overdue " : ""}
              {formatRelativeTime(task.dueAt)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

type CreateTaskFormProps = {
  leadId: string;
  onDone: () => void;
};

function CreateTaskForm({ leadId, onDone }: CreateTaskFormProps) {
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("follow_up");
  const createTask = useCreateTask();

  function submit() {
    const t = title.trim();
    if (!t) {
      Alert.alert("Required", "Task title is required.");
      return;
    }
    createTask.mutate(
      { title: t, taskType, leadId },
      {
        onSuccess: () => {
          setTitle("");
          onDone();
        },
        onError: (err) => {
          Alert.alert("Error", err instanceof Error ? err.message : "Failed to create task.");
        },
      },
    );
  }

  return (
    <View style={styles.createForm}>
      <TextInput
        style={styles.createInput}
        placeholder="Task title..."
        placeholderTextColor={colors.textMutedDark}
        value={title}
        onChangeText={setTitle}
      />
      <View style={styles.typeRow}>
        {TASK_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.typeChip, taskType === t.value && styles.typeChipActive]}
            onPress={() => setTaskType(t.value)}
          >
            <Ionicons
              name={t.icon}
              size={12}
              color={taskType === t.value ? "#fff" : colors.textMutedDark}
            />
            <Text style={[styles.typeChipText, taskType === t.value && styles.typeChipTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.createActions}>
        <Pressable style={styles.cancelBtn} onPress={onDone} disabled={createTask.isPending}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, createTask.isPending && { opacity: 0.6 }]}
          onPress={submit}
          disabled={createTask.isPending}
        >
          {createTask.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveText}>Add task</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function TasksSection({ leadId }: { leadId: string }) {
  const { data, isLoading } = useLeadTasks(leadId);
  const completeTask = useCompleteTask();
  const [showCreate, setShowCreate] = useState(false);

  const tasks = data?.items ?? [];
  const active = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const done = tasks.filter((t) => t.status === "completed" || t.status === "cancelled");

  function handleComplete(taskId: string) {
    completeTask.mutate(taskId, {
      onError: (err) => {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to complete task.");
      },
    });
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Tasks
          {active.length > 0 ? <Text style={styles.badge}> {active.length}</Text> : null}
        </Text>
        <Pressable style={styles.addBtn} onPress={() => setShowCreate((v) => !v)}>
          <Ionicons name={showCreate ? "close" : "add"} size={18} color={colors.primaryLight} />
          <Text style={styles.addBtnText}>{showCreate ? "Cancel" : "Add task"}</Text>
        </Pressable>
      </View>

      {showCreate ? <CreateTaskForm leadId={leadId} onDone={() => setShowCreate(false)} /> : null}

      {isLoading ? (
        <ActivityIndicator color={colors.primaryLight} style={{ marginVertical: spacing.sm }} />
      ) : active.length === 0 && !showCreate ? (
        <Text style={styles.empty}>No open tasks. Add one to stay on track.</Text>
      ) : (
        active.map((task) => <TaskRow key={task.id} task={task} onComplete={handleComplete} />)
      )}

      {done.length > 0 ? (
        <View style={styles.doneSection}>
          <Text style={styles.doneSectionLabel}>{done.length} completed</Text>
          {done.map((task) => (
            <TaskRow key={task.id} task={task} onComplete={handleComplete} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  headerText: { ...typography.caption, color: colors.textDark, fontWeight: "700" },
  badge: { color: colors.primaryLight },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  addBtnText: { color: colors.primaryLight, fontSize: 12, fontWeight: "600" },
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  taskRowDone: { opacity: 0.5 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxDone: { borderColor: colors.success, backgroundColor: "rgba(16,185,129,0.1)" },
  taskBody: { flex: 1 },
  taskTitle: { color: colors.textDark, fontSize: 14, fontWeight: "600" },
  taskTitleDone: { textDecorationLine: "line-through", color: colors.textMutedDark },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  taskMetaText: {
    color: colors.textMutedDark,
    fontSize: 12,
    textTransform: "capitalize",
  },
  overdue: { color: "#ef4444" },
  doneSection: { marginTop: spacing.sm },
  doneSectionLabel: {
    color: colors.textMutedDark,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  empty: { color: colors.textMutedDark, fontSize: 13, textAlign: "center", paddingVertical: 8 },
  createForm: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  createInput: {
    backgroundColor: colors.backgroundDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    color: colors.textDark,
    padding: spacing.sm,
    fontSize: 14,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.backgroundDark,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { color: colors.textMutedDark, fontSize: 11, fontWeight: "600" },
  typeChipTextActive: { color: "#fff" },
  createActions: { flexDirection: "row", gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelText: { color: colors.textDark, fontWeight: "600", fontSize: 13 },
  saveBtn: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
