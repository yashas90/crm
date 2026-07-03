import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import {
  PipelineCloseReasonModal,
  PipelineStagePickerModal,
  requiresCloseReason,
} from "@/components/pipeline/PipelineStageModals";
import { ErrorState } from "@/components/ui/ErrorState";
import type { LeadRow } from "@/hooks/use-leads";
import { type PipelineFilter, usePipelineLeads, useUpdateLeadStage } from "@/hooks/use-pipeline";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import { useIsManager } from "@/hooks/use-role";
import { useTeamMembers } from "@/hooks/use-users";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { buildLeadBrowserParams } from "@/lib/lead-browser";
import { isNaLeadStatus } from "@/lib/lead-status-options";
import {
  ACTIVE_PIPELINE_STAGES,
  CLOSED_PIPELINE_STAGES,
  PIPELINE_STAGES,
  groupLeadsByStage,
  pipelineStageLabel,
} from "@/lib/pipeline";
import type { MainTabParamList } from "@/navigation/types";
import { colors, radii, shadows, spacing, typography } from "@/theme";
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

type PendingMove = {
  lead: LeadRow;
  stage: LeadStatus;
};

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
  const [expandedClosed, setExpandedClosed] = useState<Record<string, boolean>>({});
  const [stagePickerLead, setStagePickerLead] = useState<LeadRow | null>(null);
  const [pendingClose, setPendingClose] = useState<PendingMove | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const pipeline = usePipelineLeads(filter);
  const stagesQuery = usePipelineStages();
  const updateStage = useUpdateLeadStage();

  const stageConfig = stagesQuery.data ?? {
    all: PIPELINE_STAGES,
    active: ACTIVE_PIPELINE_STAGES,
    closed: CLOSED_PIPELINE_STAGES,
    fromApi: false,
  };

  const leads = useMemo(
    () => (pipeline.data?.items ?? []).filter((lead) => !isNaLeadStatus(lead.leadStatus)),
    [pipeline.data?.items],
  );
  const browserLeads = leads;
  const board = useMemo(() => groupLeadsByStage(leads, stageConfig.all), [leads, stageConfig.all]);
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
        params: buildLeadBrowserParams(browserLeads, leadId),
      });
    },
    [browserLeads, navigation],
  );

  const applyStageChange = useCallback(
    async (leadId: string, stage: LeadStatus, closeReason?: string, closeReasonNote?: string) => {
      try {
        await updateStage.mutateAsync({ leadId, stage, closeReason, closeReasonNote });
      } catch (err) {
        setErrorToast(err instanceof Error ? err.message : "Failed to move lead.");
        setTimeout(() => setErrorToast(null), 3500);
      }
    },
    [updateStage],
  );

  const beginStageMove = useCallback(
    (lead: LeadRow, stage: LeadStatus) => {
      if (requiresCloseReason(stage)) {
        setPendingClose({ lead, stage });
        setStagePickerLead(null);
        return;
      }
      void applyStageChange(lead.id, stage);
      setStagePickerLead(null);
    },
    [applyStageChange],
  );

  const handleStageSelect = useCallback(
    (stage: LeadStatus) => {
      if (!stagePickerLead) return;
      beginStageMove(stagePickerLead, stage);
    },
    [beginStageMove, stagePickerLead],
  );

  const handleQuickMove = useCallback(
    (leadId: string, stage: LeadStatus) => {
      const lead = leads.find((item) => item.id === leadId);
      if (!lead) return;
      beginStageMove(lead, stage);
    },
    [beginStageMove, leads],
  );

  const toggleClosedColumn = useCallback((stageKey: string) => {
    setExpandedClosed((prev) => ({ ...prev, [stageKey]: !prev[stageKey] }));
  }, []);

  if (pipeline.isError && !pipeline.data) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Pipeline</Text>
        <Text style={styles.subtitle}>
          {stageConfig.fromApi ? "Org stages from CRM" : "Default stages"} · long-press or tap → to
          move
        </Text>
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
        <ActivityIndicator color={colors.primary} style={styles.loader} />
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
              tintColor={colors.primary}
            />
          }
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.boardContent}
            nestedScrollEnabled
          >
            {stageConfig.active.map((stage) => (
              <PipelineColumn
                key={stage.id ?? stage.key}
                stage={stage}
                leads={board[stage.key] ?? []}
                allStages={stageConfig.all}
                showAssignee={isManager}
                onLeadPress={handleLeadPress}
                onLeadLongPress={setStagePickerLead}
                onQuickMove={handleQuickMove}
              />
            ))}
            {stageConfig.closed.map((stage) => (
              <PipelineColumn
                key={stage.id ?? stage.key}
                stage={stage}
                leads={board[stage.key] ?? []}
                allStages={stageConfig.all}
                collapsed={!expandedClosed[stage.key]}
                showAssignee={isManager}
                onToggleCollapse={() => toggleClosedColumn(stage.key)}
                onLeadPress={handleLeadPress}
                onLeadLongPress={setStagePickerLead}
                onQuickMove={handleQuickMove}
              />
            ))}
          </ScrollView>
        </ScrollView>
      )}

      <PipelineStagePickerModal
        visible={Boolean(stagePickerLead)}
        lead={stagePickerLead}
        stages={stageConfig.all}
        onClose={() => setStagePickerLead(null)}
        onSelectStage={handleStageSelect}
      />

      <PipelineCloseReasonModal
        visible={Boolean(pendingClose)}
        lead={pendingClose?.lead ?? null}
        stage={pendingClose?.stage ?? null}
        stageLabel={
          pendingClose ? pipelineStageLabel(pendingClose.stage, stageConfig.all) : "Closed"
        }
        onClose={() => setPendingClose(null)}
        onConfirm={(closeReason, closeReasonNote) => {
          if (!pendingClose) return;
          void applyStageChange(
            pendingClose.lead.id,
            pendingClose.stage,
            closeReason,
            closeReasonNote,
          );
          setPendingClose(null);
        }}
      />

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
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  title: { ...typography.heading, color: colors.text, fontSize: 22 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
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
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.neuSm,
  },
  chipActive: {
    backgroundColor: "#dbeafe",
    borderColor: colors.primary,
  },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
  agentPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  agentPickerText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  agentPickerHint: { color: colors.textMuted, fontSize: 11 },
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
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "70%",
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  modalOption: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionText: { color: colors.text, fontSize: 16 },
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
