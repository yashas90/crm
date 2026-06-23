import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CallLogItem } from "@/hooks/use-call-logs";
import { formatDateTime } from "@/lib/dates";
import { colors, radii, spacing } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

const OUTCOME_STYLES: Record<string, { label: string; backgroundColor: string; color: string }> = {
  answered: {
    label: "Answered",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    color: colors.success,
  },
  no_answer: {
    label: "No Answer",
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    color: colors.warning,
  },
  busy: { label: "Busy", backgroundColor: "rgba(239, 68, 68, 0.2)", color: colors.danger },
  left_voicemail: {
    label: "Left Voicemail",
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    color: "#c084fc",
  },
};

function outcomeStyle(outcome: string | null) {
  if (!outcome) {
    return {
      label: "Unknown",
      backgroundColor: "rgba(148, 163, 184, 0.15)",
      color: colors.textMuted,
    };
  }
  return (
    OUTCOME_STYLES[outcome] ?? {
      label: outcome.replace(/_/g, " "),
      backgroundColor: "rgba(148, 163, 184, 0.15)",
      color: colors.textMuted,
    }
  );
}

function formatDurationMinutes(minutes: number) {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type CallLogListItemProps = {
  item: CallLogItem;
  expanded: boolean;
  onToggle: () => void;
  onViewLead: (leadId: string) => void;
};

export function CallLogListItem({ item, expanded, onToggle, onViewLead }: CallLogListItemProps) {
  const badge = outcomeStyle(item.outcome);
  const displayName = item.leadName?.trim() || "Unknown lead";

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerMain}>
          <Text style={styles.leadName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.phone} numberOfLines={1}>
            {item.phone}
          </Text>
          <View style={styles.metaRow}>
            <Badge
              label={badge.label}
              backgroundColor={badge.backgroundColor}
              color={badge.color}
            />
            <Text style={styles.metaText}>{formatDurationMinutes(item.duration)}</Text>
            <Text style={styles.metaText}>{formatDateTime(item.calledAt)}</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.detailLabel}>Full timestamp</Text>
          <Text style={styles.detailValue}>{formatDateTime(item.calledAt)}</Text>

          <Text style={styles.detailLabel}>Notes</Text>
          <Text style={styles.notes}>{item.notes?.trim() || "No notes recorded."}</Text>

          {item.leadId ? (
            <Button
              label="View Lead"
              variant="secondary"
              onPress={() => onViewLead(item.leadId!)}
              style={styles.viewLeadBtn}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerPressed: { opacity: 0.85 },
  headerMain: { flex: 1, gap: 4 },
  leadName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  phone: { color: colors.textMuted, fontSize: 14 },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  detailValue: { color: colors.text, fontSize: 14 },
  notes: { color: colors.text, fontSize: 14, lineHeight: 20 },
  viewLeadBtn: { marginTop: spacing.sm },
});
