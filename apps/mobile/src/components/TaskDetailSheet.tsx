import { type Task, useCompleteTask, useTask } from "@/hooks/use-tasks";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type TaskDetailSheetProps = {
  taskId: string | null;
  visible: boolean;
  onClose: () => void;
  onViewLead: (leadId: string) => void;
};

function formatDue(dueAt: string | null) {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function TaskDetailSheet({ taskId, visible, onClose, onViewLead }: TaskDetailSheetProps) {
  const { data: task, isLoading } = useTask(taskId ?? "");
  const completeTask = useCompleteTask();
  const isDone = task?.status === "completed" || task?.status === "cancelled";

  function handleComplete() {
    if (!task) return;
    completeTask.mutate(task.id, {
      onSuccess: onClose,
      onError: (err) =>
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to complete task"),
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {isLoading || !task ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.meta}>
                {task.taskType.replace(/_/g, " ")} · {task.priority} priority
              </Text>
              {task.dueAt ? <Text style={styles.due}>Due {formatDue(task.dueAt)}</Text> : null}
              {task.description ? <Text style={styles.description}>{task.description}</Text> : null}

              {(task.noteEntries ?? []).length > 0 ? (
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>Comments</Text>
                  {(task.noteEntries ?? []).map((entry) => (
                    <View key={entry.id} style={styles.noteCard}>
                      <Text style={styles.noteAuthor}>{entry.authorName}</Text>
                      <Text style={styles.noteText}>{entry.text}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.actions}>
                {!isDone ? (
                  <Pressable
                    testID="task-mark-complete"
                    style={[styles.primaryBtn, completeTask.isPending && { opacity: 0.6 }]}
                    onPress={handleComplete}
                    disabled={completeTask.isPending}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Mark complete</Text>
                  </Pressable>
                ) : null}
                {task.leadId || task.lead ? (
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => {
                      const leadId = task.leadId ?? task.lead!.id;
                      onClose();
                      InteractionManager.runAfterInteractions(() => {
                        onViewLead(leadId);
                      });
                    }}
                  >
                    <Ionicons name="person-outline" size={18} color={colors.primary} />
                    <Text style={styles.secondaryBtnText}>
                      View{" "}
                      {task.lead ? `${task.lead.firstName} ${task.lead.lastName}`.trim() : "lead"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function isTaskOverdue(task: Task) {
  if (task.status === "completed" || task.status === "cancelled") return false;
  if (!task.dueAt) return false;
  return new Date(task.dueAt) < new Date();
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { ...typography.subheading, color: colors.text, fontSize: 18 },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 4, textTransform: "capitalize" },
  due: { color: colors.textMuted, fontSize: 13, marginTop: 8 },
  description: { color: colors.text, fontSize: 14, marginTop: spacing.md, lineHeight: 20 },
  notesSection: { marginTop: spacing.lg },
  notesLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  noteCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteAuthor: { color: colors.text, fontSize: 12, fontWeight: "600" },
  noteText: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: "600", fontSize: 15 },
});
