import { Badge } from "@/components/ui/Badge";
import type { LeadRow } from "@/hooks/use-leads";
import { formatRelativeTime } from "@/lib/dates";
import { type PipelineStage, isClosedPipelineStageKey } from "@/lib/pipeline";
import { colors, radii, spacing } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import type { LeadStatus } from "@propninja/types/enums";
import { Pressable, StyleSheet, Text, View } from "react-native";

type PipelineLeadCardProps = {
  lead: LeadRow;
  stage: LeadStatus;
  stages: PipelineStage[];
  showAssignee?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onQuickMove?: (leadId: string, stage: LeadStatus) => void;
};

function temperatureMeta(temperature: string | null | undefined) {
  switch (temperature) {
    case "hot":
      return { icon: "flame" as const, color: "#ef4444" };
    case "warm":
      return { icon: "sunny" as const, color: "#f59e0b" };
    case "cold":
      return { icon: "snow" as const, color: "#38bdf8" };
    default:
      return null;
  }
}

function formatEstimatedValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `₹${num.toLocaleString("en-IN")}`;
}

export function PipelineLeadCard({
  lead,
  stage,
  stages,
  showAssignee,
  onPress,
  onLongPress,
  onQuickMove,
}: PipelineLeadCardProps) {
  const tintStyle = stage === "won" ? styles.cardWon : stage === "lost" ? styles.cardLost : null;

  const activityAt = lead.lastContactedAt ?? lead.nextFollowupAt;
  const isOverdue = lead.nextFollowupAt ? new Date(lead.nextFollowupAt) < new Date() : false;
  const temp = temperatureMeta(lead.temperature);
  const valueLabel = formatEstimatedValue(lead.estimatedValue);
  const quickTargets = stages.filter(
    (s) => s.key !== lead.leadStatus && !isClosedPipelineStageKey(s.key),
  );

  return (
    <Pressable
      style={({ pressed }) => [styles.card, tintStyle, pressed && styles.cardPressed]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <View style={styles.titleRow}>
        <Text style={styles.name} numberOfLines={1}>
          {lead.firstName} {lead.lastName}
        </Text>
        {temp ? <Ionicons name={temp.icon} size={14} color={temp.color} /> : null}
      </View>

      <Text style={styles.phone} numberOfLines={1}>
        {lead.phone ?? "No phone"}
      </Text>

      {lead.leadSource ? (
        <Badge
          label={lead.leadSource}
          backgroundColor="rgba(148, 163, 184, 0.15)"
          color={colors.textMuted}
        />
      ) : null}

      {lead.nextFollowupAt ? (
        <Text style={[styles.followUp, isOverdue && styles.followUpOverdue]}>
          Follow-up {formatRelativeTime(lead.nextFollowupAt)}
        </Text>
      ) : (
        <Text style={styles.activity}>
          {activityAt ? formatRelativeTime(activityAt) : "No activity"}
        </Text>
      )}

      {valueLabel ? <Text style={styles.value}>{valueLabel}</Text> : null}

      {showAssignee ? (
        <Text style={styles.assignee} numberOfLines={1}>
          {lead.assignedUser?.name ?? "Unassigned"}
        </Text>
      ) : null}

      {onQuickMove && quickTargets.length > 0 ? (
        <View style={styles.quickRow}>
          {quickTargets.slice(0, 3).map((target) => (
            <Pressable
              key={target.key}
              style={styles.quickChip}
              onPress={() => onQuickMove(lead.id, target.key as LeadStatus)}
            >
              <Text style={styles.quickChipText}>→ {target.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: 4,
  },
  cardWon: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  cardLost: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  cardPressed: { opacity: 0.88 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { color: colors.text, fontSize: 15, fontWeight: "700", flex: 1 },
  phone: { color: colors.textMuted, fontSize: 13 },
  activity: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  followUp: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  followUpOverdue: { color: colors.danger, fontWeight: "700" },
  value: { color: "#059669", fontSize: 12, fontWeight: "700", marginTop: 2 },
  assignee: { color: colors.primary, fontSize: 11, fontWeight: "600" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  quickChip: {
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickChipText: { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
});
