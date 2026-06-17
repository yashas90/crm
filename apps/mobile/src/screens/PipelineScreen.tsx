import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { ErrorState } from "@/components/ui/ErrorState";
import type { LeadRow } from "@/hooks/use-leads";
import { type PipelineFilter, usePipelineLeads, useUpdateLeadStage } from "@/hooks/use-pipeline";
import { useIsManager } from "@/hooks/use-role";
import { useTeamMembers } from "@/hooks/use-users";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import {
  ACTIVE_PIPELINE_STAGES,
  CLOSED_PIPELINE_STAGES,
  PIPELINE_STAGES,
  groupLeadsByStage,
} from "@/lib/pipeline";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { LeadStatus } from "@propninja/types/enums";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Props = BottomTabScreenProps<MainTabParamList, "PipelineTab">;

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function PipelineScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const isManager = useIsManager();
  const members = useTeamMembers();
  const [filter, setFilter] = useState<PipelineFilter>(isManager ? "all" : "mine");
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [wonExpanded, setWonExpanded] = useState(false);
  const [lostExpanded, setLostExpanded] = useState(false);
  const [stagePickerLead, setStagePickerLead] = useState<LeadRow | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const pipeline = usePipelineLeads(filter);
  const updateStage = useUpdateLeadStage();

  const leads = pipeline.data?.items ?? [];
  const board = useMemo(() => groupLeadsByStage(leads), [leads]);
  const truncated = (pipeline.data?.total ?? 0) > leads.length;

  const refetch = useCallback(() => pipeline.refetch(), [pipeline]);
  useRefreshOnFocus(refetch);

  const agentLabel =
    filter === "all"
      ? "All agents"
      : filter === "mine"
        ? "Mine"
        : (members.data?.items.find((m) => m.id === filter)?.name ?? "Agent");

  const handleLeadPress = useCallback(
    (leadId: string) => {
      navigation.navigate("LeadsTab", {
        screen: "LeadDetailScreen",
        params: { leadId },
      });
    },
    [navigation],
  );

  const handleStageSelect = useCallback(
    async (stage: LeadStatus) => {
      if (!stagePickerLead) return;
      const leadId = stagePickerLead.id;
      setStagePickerLead(null);
      try {
        await updateStage.mutateAsync({ leadId, stage });
      } catch (err) {
        setErrorToast(err instanceof Error ? err.message : "Failed to move lead.");
        setTimeout(() => setErrorToast(null), 3500);
      }
    },
    [stagePickerLead, updateStage],
  );

  if (pipeline.isError && !pipeline.data) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Pipeline</Text>
        <Text style={styles.subtitle}>Long-press a card to change stage</Text>
      </View>

      {isManager ? (
        <View style={styles.filterRow}>
          <FilterChip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip label="Mine" active={filter === "mine"} onPress={() => setFilter("mine")} />
          <Pressable style={styles.agentPicker} onPress={() => setAgentPickerOpen(true)}>
            <Text style={styles.agentPickerText}>{agentLabel}</Text>
            <Text style={styles.agentPickerHint}>Agent ▾</Text>
          </Pressable>
        </View>
      ) : null}

      {truncated ? (
        <Text style={styles.truncatedBanner}>Showing recent {leads.length} leads</Text>
      ) : null}

      {pipeline.isLoading && !pipeline.data ? (
        <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
      ) : (
        <ScrollView
          style={styles.boardScroll}
          contentContainerStyle={{
            paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom,
          }}
          refreshControl={
            <RefreshControl
              refreshing={pipeline.isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.primaryLight}
            />
          }
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.boardContent}
            nestedScrollEnabled
          >
            {ACTIVE_PIPELINE_STAGES.map((stage) => (
              <PipelineColumn
                key={stage.key}
                stage={stage}
                leads={board[stage.key]}
                showAssignee={isManager}
                onLeadPress={handleLeadPress}
                onLeadLongPress={setStagePickerLead}
              />
            ))}
            {CLOSED_PIPELINE_STAGES.map((stage) => (
              <PipelineColumn
                key={stage.key}
                stage={stage}
                leads={board[stage.key]}
                collapsed={stage.key === "won" ? !wonExpanded : !lostExpanded}
                showAssignee={isManager}
                onToggleCollapse={() => {
                  if (stage.key === "won") setWonExpanded((v) => !v);
                  if (stage.key === "lost") setLostExpanded((v) => !v);
                }}
                onLeadPress={handleLeadPress}
                onLeadLongPress={setStagePickerLead}
              />
            ))}
          </ScrollView>
        </ScrollView>
      )}

      <Modal visible={Boolean(stagePickerLead)} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setStagePickerLead(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Move to stage</Text>
            {stagePickerLead ? (
              <Text style={styles.modalSubtitle}>
                {stagePickerLead.firstName} {stagePickerLead.lastName}
              </Text>
            ) : null}
            {PIPELINE_STAGES.filter((s) => s.key !== stagePickerLead?.leadStatus).map((stage) => (
              <Pressable
                key={stage.key}
                style={styles.modalOption}
                onPress={() => void handleStageSelect(stage.key)}
              >
                <Text style={styles.modalOptionText}>{stage.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={agentPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setAgentPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filter by agent</Text>
            {(members.data?.items ?? []).map((member) => (
              <Pressable
                key={member.id}
                style={styles.modalOption}
                onPress={() => {
                  setFilter(member.id);
                  setAgentPickerOpen(false);
                }}
              >
                <Text style={styles.modalOptionText}>{member.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {errorToast ? (
        <View style={[styles.errorToast, { bottom: TAB_BAR_SCROLL_PADDING + insets.bottom }]}>
          <Text style={styles.errorToastText}>{errorToast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  title: { ...typography.heading, color: colors.textDark, fontSize: 22 },
  subtitle: { color: colors.textMutedDark, fontSize: 13, marginTop: 2 },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: "center",
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cardDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  chipActive: {
    backgroundColor: "rgba(20, 184, 166, 0.15)",
    borderColor: colors.primaryLight,
  },
  chipText: { color: colors.textMutedDark, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.primaryLight },
  agentPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.cardDark,
  },
  agentPickerText: { color: colors.textDark, fontSize: 12, fontWeight: "600" },
  agentPickerHint: { color: colors.textMutedDark, fontSize: 11 },
  truncatedBanner: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  loader: { marginTop: spacing.xl },
  boardScroll: { flex: 1 },
  boardContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    alignItems: "flex-start",
    minHeight: 480,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.cardDark,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "70%",
  },
  modalTitle: { color: colors.textDark, fontSize: 18, fontWeight: "700" },
  modalSubtitle: { color: colors.textMutedDark, marginTop: 4, marginBottom: spacing.md },
  modalOption: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  modalOptionText: { color: colors.textDark, fontSize: 16 },
  errorToast: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorToastText: { color: "#fff", textAlign: "center", fontWeight: "600" },
});
