import { PipelineLeadCard } from "@/components/pipeline/PipelineLeadCard";
import type { LeadRow } from "@/hooks/use-leads";
import { type PipelineStage, pipelineStageLabel } from "@/lib/pipeline";
import { colors, radii, spacing, typography } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import type { LeadStatus } from "@propninja/types/enums";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

const COLUMN_WIDTH = 272;

type PipelineColumnProps = {
  stage: PipelineStage;
  leads: LeadRow[];
  collapsed?: boolean;
  showAssignee?: boolean;
  onToggleCollapse?: () => void;
  onLeadPress: (leadId: string) => void;
  onLeadLongPress: (lead: LeadRow) => void;
};

export function PipelineColumn({
  stage,
  leads,
  collapsed,
  showAssignee,
  onToggleCollapse,
  onLeadPress,
  onLeadLongPress,
}: PipelineColumnProps) {
  const headerTint =
    stage.key === "won" ? styles.headerWon : stage.key === "lost" ? styles.headerLost : null;

  return (
    <View style={styles.column}>
      <Pressable
        style={[styles.header, headerTint]}
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
              color={colors.textMutedDark}
            />
          ) : null}
        </View>
      </Pressable>

      {!collapsed ? (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PipelineLeadCard
              lead={item}
              stage={stage.key}
              showAssignee={showAssignee}
              onPress={() => onLeadPress(item.id)}
              onLongPress={() => onLeadLongPress(item)}
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
            Tap to expand {pipelineStageLabel(stage.key as LeadStatus)}
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
    borderColor: colors.borderDark,
    backgroundColor: colors.cardDark,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerWon: {
    borderColor: "rgba(16, 185, 129, 0.35)",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  headerLost: {
    borderColor: "rgba(239, 68, 68, 0.35)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { ...typography.subheading, color: colors.textDark, fontSize: 14, flex: 1 },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: { color: colors.primaryLight, fontSize: 12, fontWeight: "800" },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.md },
  empty: {
    color: colors.textMutedDark,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  collapsedHint: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderStyle: "dashed",
  },
  collapsedText: { color: colors.textMutedDark, fontSize: 12, textAlign: "center" },
});

export const PIPELINE_COLUMN_WIDTH = COLUMN_WIDTH;
