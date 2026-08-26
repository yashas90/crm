import { Badge } from "@/components/ui/Badge";
import type { LeadRow } from "@/hooks/use-leads";
import { formatLeadSourceDisplay, isMetaLeadSource } from "@/lib/lead-sources";
import { getLeadStatusDisplay } from "@/lib/lead-status-display";
import { colors, spacing } from "@/theme";
import { neuCard } from "@/theme/neubrutal";
import { statusStyle } from "@/theme/status";
import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

function highlightParts(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [{ text, highlight: false }] as const;

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const parts: { text: string; highlight: boolean }[] = [];
  let start = 0;
  let index = lowerText.indexOf(lowerQuery, start);

  while (index !== -1) {
    if (index > start) parts.push({ text: text.slice(start, index), highlight: false });
    parts.push({ text: text.slice(index, index + trimmed.length), highlight: true });
    start = index + trimmed.length;
    index = lowerText.indexOf(lowerQuery, start);
  }

  if (start < text.length) parts.push({ text: text.slice(start), highlight: false });
  return parts;
}

function HighlightedText({
  text,
  query,
  style,
  highlightStyle,
}: {
  text: string;
  query?: string;
  style: object;
  highlightStyle: object;
}) {
  if (!query?.trim()) return <Text style={style}>{text}</Text>;
  const parts = highlightParts(text, query);
  return (
    <Text style={style}>
      {parts.map((part, index) => (
        <Text key={`${part.text}-${index}`} style={part.highlight ? highlightStyle : undefined}>
          {part.text}
        </Text>
      ))}
    </Text>
  );
}

function initials(lead: LeadRow) {
  const first = (lead.firstName ?? "").trim().charAt(0);
  const last = (lead.lastName ?? "").trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

function daysSinceContact(value: string | null | undefined) {
  if (!value) return "Never contacted";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return "Never contacted";
  if (days === 0) return "Contacted today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export type LeadListItemProps = {
  lead: LeadRow;
  onPress: (leadId: string) => void;
  highlightQuery?: string;
};

function leadRowEqual(a: LeadRow, b: LeadRow) {
  return (
    a.id === b.id &&
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.phone === b.phone &&
    a.city === b.city &&
    a.leadStatus === b.leadStatus &&
    a.temperature === b.temperature &&
    a.leadSource === b.leadSource &&
    a.leadCode === b.leadCode &&
    a.lastContactedAt === b.lastContactedAt &&
    a.nextFollowupAt === b.nextFollowupAt
  );
}

function LeadListItemComponent({ lead, onPress, highlightQuery }: LeadListItemProps) {
  const display = getLeadStatusDisplay(lead);
  const status = statusStyle(display.tone);
  const sourceLabel = formatLeadSourceDisplay(lead.leadSource);
  const metaSource = isMetaLeadSource(lead.leadSource);
  const phone = lead.phone ?? "No phone";
  const subline = lead.city ? `${phone} - ${lead.city}` : phone;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(lead.id)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(lead)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.leadCode}>
          <HighlightedText
            text={lead.leadCode}
            query={highlightQuery}
            style={styles.leadCode}
            highlightStyle={styles.leadCodeHighlight}
          />
        </Text>
        <View style={styles.titleRow}>
          <HighlightedText
            text={`${lead.firstName} ${lead.lastName}`.trim()}
            query={highlightQuery}
            style={styles.name}
            highlightStyle={styles.nameHighlight}
          />
          <Badge label={display.primary} backgroundColor={status.bg} color={status.text} />
        </View>
        <Text style={styles.subline} numberOfLines={1}>
          {subline}
        </Text>
        <View style={styles.metaRow}>
          {sourceLabel ? (
            <Badge
              label={sourceLabel}
              backgroundColor={metaSource ? "#E7F0FF" : colors.card}
              color={metaSource ? "#1877F2" : colors.text}
            />
          ) : (
            <Badge label="No source" backgroundColor={colors.border} color={colors.textMuted} />
          )}
          <Text style={styles.contactLine}>{daysSinceContact(lead.lastContactedAt)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export const LeadListItem = memo(LeadListItemComponent, (prev, next) => {
  return (
    prev.onPress === next.onPress &&
    prev.highlightQuery === next.highlightQuery &&
    leadRowEqual(prev.lead, next.lead)
  );
});

LeadListItem.displayName = "LeadListItem";

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...neuCard,
  },
  cardPressed: { opacity: 0.88 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardBody: { flex: 1, minWidth: 0 },
  leadCode: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  leadCodeHighlight: { backgroundColor: "#fef08a", color: colors.text },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  name: { color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 },
  nameHighlight: { backgroundColor: "#fef08a" },
  subline: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  contactLine: { color: colors.textMuted, fontSize: 12 },
});
