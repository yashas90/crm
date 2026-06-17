import { Badge } from "@/components/ui/Badge";
import type { LeadRow } from "@/hooks/use-leads";
import { formatRelativeTime } from "@/lib/dates";
import { colors, radii, spacing } from "@/theme";
import type { LeadStatus } from "@propninja/types/enums";
import { Pressable, StyleSheet, Text, View } from "react-native";

type PipelineLeadCardProps = {
  lead: LeadRow;
  stage: LeadStatus;
  showAssignee?: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

export function PipelineLeadCard({
  lead,
  stage,
  showAssignee,
  onPress,
  onLongPress,
}: PipelineLeadCardProps) {
  const tintStyle = stage === "won" ? styles.cardWon : stage === "lost" ? styles.cardLost : null;

  const activityAt = lead.lastContactedAt ?? lead.nextFollowupAt;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, tintStyle, pressed && styles.cardPressed]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <Text style={styles.name} numberOfLines={1}>
        {lead.firstName} {lead.lastName}
      </Text>
      <Text style={styles.phone} numberOfLines={1}>
        {lead.phone ?? "No phone"}
      </Text>
      {lead.leadSource ? (
        <Badge
          label={lead.leadSource}
          backgroundColor="rgba(148, 163, 184, 0.15)"
          color={colors.textMutedDark}
        />
      ) : null}
      <Text style={styles.activity}>
        {activityAt ? formatRelativeTime(activityAt) : "No activity"}
      </Text>
      {showAssignee ? (
        <Text style={styles.assignee} numberOfLines={1}>
          {lead.assignedUser?.name ?? "Unassigned"}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
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
  name: { color: colors.textDark, fontSize: 15, fontWeight: "700" },
  phone: { color: colors.textMutedDark, fontSize: 13 },
  activity: { color: colors.textMutedDark, fontSize: 11, marginTop: 2 },
  assignee: { color: colors.primaryLight, fontSize: 11, fontWeight: "600" },
});
