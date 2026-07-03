import { PipelineLeadCard } from "@/components/pipeline/PipelineLeadCard";
import type { LeadRow } from "@/hooks/use-leads";
import {
  type PipelineStage,
  formatPipelineValue,
  pipelineStageHeaderStyle,
  pipelineStageLabel,
  sumPipelineColumnValue,
} from "@/lib/pipeline";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import type { LeadStatus } from "@propninja/types/enums";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

const COLUMN_WIDTH = 272;

type PipelineColumnProps = {
  stage: PipelineStage;
  leads: LeadRow[];
  allStages: PipelineStage[];
  collapsed?: boolean;
  showAssignee?: boolean;
  onToggleCollapse?: () => void;
  onLeadPress: (leadId: string) => void;
  onLeadLongPress: (lead: LeadRow) => void;
  onQuickMove?: (leadId: string, stage: LeadStatus) => void;
};

export function PipelineColumn({
  stage,
  leads,
  allStages,
  collapsed,
  showAssignee,
  onToggleCollapse,
  onLeadPress,
  onLeadLongPress,
  onQuickMove,
}: PipelineColumnProps) {
  const headerColorStyle = pipelineStageHeaderStyle(stage);
  const totalValue = formatPipelineValue(sumPipelineColumnValue(leads));

  return (
    <View style={styles.column}>
      <Pressable
        style={[styles.header, headerColorStyle]}
        onPress={stage.collapsible ? onToggleCollapse : undefined}
        disabled={!stage.collapsible}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{stage.label}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{leads.length}</Text>
          </View>
          {stage.collapsible ? (
            <Ionicons
              name={collapsed ? "chevron-down" : "chevron-up"}
              size={16}
              color={colors.textMuted}
            />
          ) : null}
        </View>
        {totalValue ? <Text style={styles.valueText}>{totalValue}</Text> : null}
      </Pressable>

      {!collapsed ? (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PipelineLeadCard
              lead={item}
              stage={stage.key as LeadStatus}
              stages={allStages}
              showAssignee={showAssignee}
              onPress={() => onLeadPress(item.id)}
              onLongPress={() => onLeadLongPress(item)}
              onQuickMove={onQuickMove}
            />
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          ListEmptyComponent={<Text style={styles.empty}>No leads</Text>}
        />
      ) : (
        <Pressable style={styles.collapsedHint} onPress={onToggleCollapse}>
          <Text style={styles.collapsedText}>
            Tap to expand {pipelineStageLabel(stage.key as LeadStatus, allStages)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: COLUMN_WIDTH,
    marginRight: spacing.sm,
    maxHeight: "100%",
  },
  header: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { ...typography.subheading, color: colors.text, fontSize: 14, flex: 1 },
  valueText: { color: colors.textMuted, fontSize: 11, fontWeight: "600", marginTop: 4 },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.md },
  empty: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  collapsedHint: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  collapsedText: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
});

export const PIPELINE_COLUMN_WIDTH = COLUMN_WIDTH;
