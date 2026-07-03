import {
  type SiteVisit,
  formatVisitTime,
  visitLeadName,
  visitLocation,
  visitStatusColor,
  visitStatusLabel,
} from "@/hooks/use-site-visits";
import { colors, radii, spacing } from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type SiteVisitCardProps = {
  visit: SiteVisit;
  onPress: () => void;
  showAgent?: boolean;
  accentColor?: string;
};

export function SiteVisitCard({ visit, onPress, showAgent, accentColor }: SiteVisitCardProps) {
  const statusColor = visitStatusColor(visit.status);
  const borderColor = accentColor ?? statusColor;

  return (
    <Pressable style={[styles.card, { borderLeftColor: borderColor }]} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.time}>{formatVisitTime(visit.visitTime)}</Text>
        <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {visitStatusLabel(visit.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.leadName}>{visitLeadName(visit)}</Text>
      <Text style={styles.meta} numberOfLines={2}>
        {visitLocation(visit)}
        {showAgent && visit.agent?.name ? ` · ${visit.agent.name}` : ""}
      </Text>
      {visit.visitDate ? (
        <Text style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} /> {visit.visitDate}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    gap: 4,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  time: { color: colors.text, fontWeight: "700", fontSize: 15 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  leadName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 13 },
  dateRow: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
