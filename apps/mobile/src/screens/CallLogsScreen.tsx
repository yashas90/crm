import { RoleGate } from "@/components/RoleGate";
import { CallLogListItem } from "@/components/calls/CallLogListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  type CallLogItem,
  useCallLogsInfinite,
  useCallLogsSummaryBar,
} from "@/hooks/use-call-logs";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import {
  CALL_DATE_FILTERS,
  CALL_OUTCOME_FILTERS,
  type CallDateFilter,
  type CallOutcomeFilter,
} from "@/lib/callLogFilters";
import type { ProfileStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ProfileStackParamList, "CallLogsScreen">;

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
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SummaryBar({
  callsToday,
  callsThisWeek,
  answeredPercent,
  loading,
}: {
  callsToday: number | null;
  callsThisWeek: number | null;
  answeredPercent: number | null;
  loading: boolean;
}) {
  if (loading && callsToday === null) {
    return (
      <View style={styles.summaryBar}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{callsToday ?? "—"}</Text>
        <Text style={styles.summaryLabel}>Calls today</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{callsThisWeek ?? "—"}</Text>
        <Text style={styles.summaryLabel}>This week</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>
          {answeredPercent === null ? "—" : `${answeredPercent}%`}
        </Text>
        <Text style={styles.summaryLabel}>Answered</Text>
      </View>
    </View>
  );
}

export function CallLogsScreen({ navigation, route }: Props) {
  return (
    <RoleGate roles={["agent"]} onGoBack={() => navigation.goBack()}>
      <CallLogsScreenContent navigation={navigation} route={route} />
    </RoleGate>
  );
}

function CallLogsScreenContent({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [dateFilter, setDateFilter] = useState<CallDateFilter>(route.params?.dateFilter ?? "week");
  const [outcomeFilter, setOutcomeFilter] = useState<CallOutcomeFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.dateFilter) {
      setDateFilter(route.params.dateFilter);
    }
  }, [route.params?.dateFilter]);

  const logs = useCallLogsInfinite({ dateFilter, outcome: outcomeFilter });
  const summary = useCallLogsSummaryBar();

  const items = useMemo(
    () => logs.data?.pages.flatMap((page) => page.calls) ?? [],
    [logs.data?.pages],
  );

  const refetchAll = useCallback(
    () => Promise.all([logs.refetch(), summary.refetch()]),
    [logs, summary],
  );

  useRefreshOnFocus(refetchAll);

  const handleViewLead = useCallback(
    (leadId: string) => {
      navigation.getParent()?.navigate("LeadsTab", {
        screen: "LeadDetailScreen",
        params: { leadId },
      });
    },
    [navigation],
  );

  const handleToggle = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: CallLogItem }) => (
      <CallLogListItem
        item={item}
        expanded={expandedId === item.id}
        onToggle={() => handleToggle(item.id)}
        onViewLead={handleViewLead}
      />
    ),
    [expandedId, handleToggle, handleViewLead],
  );

  const listHeader = (
    <View>
      <SummaryBar
        callsToday={summary.callsToday}
        callsThisWeek={summary.callsThisWeek}
        answeredPercent={summary.answeredPercent}
        loading={summary.isLoading}
      />

      <Text style={styles.filterHeading}>Date</Text>
      <View style={styles.chipRow}>
        {CALL_DATE_FILTERS.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            active={dateFilter === option.id}
            onPress={() => {
              setDateFilter(option.id);
              setExpandedId(null);
            }}
          />
        ))}
      </View>

      <Text style={styles.filterHeading}>Outcome</Text>
      <View style={styles.chipRow}>
        {CALL_OUTCOME_FILTERS.map((option) => (
          <FilterChip
            key={option.id}
            label={option.label}
            active={outcomeFilter === option.id}
            onPress={() => {
              setOutcomeFilter(option.id);
              setExpandedId(null);
            }}
          />
        ))}
      </View>
    </View>
  );

  if (logs.isError && items.length === 0) {
    return <ErrorState onRetry={() => void refetchAll()} />;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: TAB_BAR_SCROLL_PADDING + insets.bottom },
        items.length === 0 && !logs.isLoading ? styles.emptyContent : null,
      ]}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        logs.isLoading ? (
          <ListSkeleton rows={4} />
        ) : (
          <EmptyState
            title="No call logs"
            message="Calls you log from leads will appear here."
            icon="call-outline"
          />
        )
      }
      ListFooterComponent={
        logs.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={styles.footerLoader} />
        ) : null
      }
      onEndReached={() => {
        if (logs.hasNextPage && !logs.isFetchingNextPage) {
          void logs.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={logs.isRefetching && !logs.isFetchingNextPage}
          onRefresh={() => void refetchAll()}
          tintColor={colors.primary}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  emptyContent: { flexGrow: 1 },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  summaryLabel: { color: colors.textMuted, fontSize: 11, marginTop: 4, textAlign: "center" },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },
  filterHeading: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: "#dbeafe",
    borderColor: colors.primary,
  },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
  loader: { marginTop: spacing.xl },
  footerLoader: { marginVertical: spacing.md },
});
