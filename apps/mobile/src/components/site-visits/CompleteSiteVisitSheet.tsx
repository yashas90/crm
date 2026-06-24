import { useProjectsList } from "@/hooks/use-projects";
import { type SiteVisit, formatVisitTime, useUpdateSiteVisit } from "@/hooks/use-site-visits";
import { colors, radii, spacing, typography } from "@/theme";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type CompleteSiteVisitSheetProps = {
  visible: boolean;
  visit: SiteVisit | null;
  onClose: () => void;
  onCompleted?: () => void;
};

export function CompleteSiteVisitSheet({
  visible,
  visit,
  onClose,
  onCompleted,
}: CompleteSiteVisitSheetProps) {
  const updateVisit = useUpdateSiteVisit();
  const projects = useProjectsList();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && visit) {
      setSelectedProjectId(visit.projectId ?? null);
    }
  }, [visible, visit?.id, visit?.projectId]);

  if (!visit) return null;

  const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}` : "Lead";

  async function handleConfirm() {
    if (!selectedProjectId) {
      Alert.alert("Project required", "Select which project the client visited.");
      return;
    }

    try {
      await updateVisit.mutateAsync({
        id: visit!.id,
        payload: { status: "completed", projectId: selectedProjectId },
      });
      onCompleted?.();
      onClose();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not complete visit");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <Text style={styles.title}>Mark site visit done</Text>
          <Text style={styles.subtitle}>
            {leadName} · {visit.visitDate} · {formatVisitTime(visit.visitTime)}
          </Text>
          <Text style={styles.prompt}>Which project did the client visit?</Text>

          {projects.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : projects.isError ? (
            <Text style={styles.errorText}>
              Could not load projects. Pull to refresh and try again.
            </Text>
          ) : (
            <FlatList
              data={projects.data ?? []}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const selected = selectedProjectId === item.id;
                return (
                  <Pressable
                    style={[styles.projectRow, selected && styles.projectRowSelected]}
                    onPress={() => setSelectedProjectId(item.id)}
                  >
                    <Text style={[styles.projectName, selected && styles.projectNameSelected]}>
                      {item.name}
                    </Text>
                    {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.errorText}>No active projects found.</Text>}
            />
          )}

          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryBtn, updateVisit.isPending && styles.btnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={updateVisit.isPending}
            >
              <Text style={styles.primaryBtnText}>
                {updateVisit.isPending ? "Saving…" : "Mark complete"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={onClose}
              disabled={updateVisit.isPending}
            >
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  title: { ...typography.subheading, color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  prompt: {
    color: colors.text,
    fontWeight: "600",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  loader: { marginVertical: spacing.lg },
  list: { maxHeight: 240 },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  projectRowSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}14`,
  },
  projectName: { color: colors.text, fontWeight: "500", flex: 1 },
  projectNameSelected: { color: colors.primary, fontWeight: "700" },
  checkmark: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  errorText: { color: colors.textMuted, fontSize: 14, paddingVertical: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.text, fontWeight: "600" },
  btnDisabled: { opacity: 0.6 },
});
