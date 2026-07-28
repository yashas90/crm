import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useSlaBreached, useSlaSummary } from "@/hooks/use-sla";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import type { ProfileStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { screenStyles } from "@/theme/screen";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ProfileStackParamList, "SlaScreen">;

const THRESHOLDS = [
  { days: 1, label: "1+ day" },
  { days: 3, label: "3+ days" },
  { days: 7, label: "7+ days" },
  { days: 14, label: "14+ days" },
];

function severityColor(days: number) {
  if (days >= 14) return colors.danger;
  if (days >= 7) return "#e11d48";
  if (days >= 3) return colors.warning;
  return "#d97706";
}

export function SlaScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [inactiveDays, setInactiveDays] = useState(3);
  const summary = useSlaSummary();
  const breached = useSlaBreached(inactiveDays);

  useRefreshOnFocus(() => Promise.all([summary.refetch(), breached.refetch()]));

  if (summary.isError && breached.isError) {
    return (
      <ErrorState
        message="Could not load SLA data"
        onRetry={() => {
          void summary.refetch();
          void breached.refetch();
        }}
      />
    );
  }

  const items = breached.data?.items ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={summary.isRefetching || breached.isRefetching}
            onRefresh={() => {
              void summary.refetch();
              void breached.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={screenStyles.sectionTitle}>Inactive leads</Text>
            <Text style={styles.subtitle}>
              Active pipeline leads with no recent calls, notes, or updates.
            </Text>

            <View style={styles.thresholdRow}>
              {THRESHOLDS.map((threshold) => {
                const count =
                  summary.data?.[`inactive_${threshold.days}d` as keyof typeof summary.data] ?? 0;
                const active = inactiveDays === threshold.days;
                return (
                  <Pressable
                    key={threshold.days}
                    style={[styles.thresholdChip, active && styles.thresholdChipActive]}
                    onPress={() => setInactiveDays(threshold.days)}
                  >
                    <Text style={[styles.thresholdCount, active && styles.thresholdCountActive]}>
                      {summary.isLoading ? "—" : String(count)}
                    </Text>
                    <Text style={[styles.thresholdLabel, active && styles.thresholdLabelActive]}>
                      {threshold.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.listHeading}>
              {breached.isLoading
                ? "Loading…"
                : `${breached.data?.total ?? 0} breach${breached.data?.total === 1 ? "" : "es"}`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          breached.isLoading ? (
            <ListSkeleton rows={5} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={40} color={colors.success} />
              <Text style={styles.emptyTitle}>No SLA breaches</Text>
              <Text style={styles.emptyText}>All leads are within the selected threshold.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const name = `${item.firstName} ${item.lastName}`.trim() || "Unnamed";
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.getParent()?.navigate("LeadsTab", {
                  screen: "LeadDetailScreen",
                  params: { leadId: item.id },
                })
              }
            >
              <View style={styles.rowTop}>
                <Text style={styles.rowName}>{name}</Text>
                <Text style={[styles.rowDays, { color: severityColor(item.daysSinceActivity) }]}>
                  {item.daysSinceActivity}d
                </Text>
              </View>
              <Text style={styles.rowMeta}>
                {item.leadStatus} · {item.assignedUser?.name ?? "Unassigned"}
              </Text>
              {item.phone ? <Text style={styles.rowPhone}>{item.phone}</Text> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBlock: { marginBottom: spacing.md, gap: spacing.sm },
  subtitle: { ...typography.body, color: colors.textMuted },
  thresholdRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  thresholdChip: {
    flexGrow: 1,
    minWidth: "45%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    padding: spacing.sm,
  },
  thresholdChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  thresholdCount: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  thresholdCountActive: { color: "#fff" },
  thresholdLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  thresholdLabelActive: { color: "rgba(255,255,255,0.9)" },
  listHeading: { ...typography.subheading, marginTop: spacing.md },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  rowName: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  rowDays: { fontSize: 14, fontWeight: "800" },
  rowMeta: { marginTop: 4, fontSize: 13, color: colors.textMuted, textTransform: "capitalize" },
  rowPhone: { marginTop: 2, fontSize: 13, color: colors.textMuted },
  empty: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
});
