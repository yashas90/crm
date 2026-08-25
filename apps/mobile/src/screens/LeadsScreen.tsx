import { LeadFilterSheet } from "@/components/LeadFilterSheet";
import { LeadListItem } from "@/components/LeadListItem";
import { LeadsSearchBar } from "@/components/LeadsSearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { QueryErrorBanner } from "@/components/ui/QueryErrorBanner";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { type LeadRow, type LeadsQuery, useInfiniteLeads } from "@/hooks/use-leads";
import { useIsAgent } from "@/hooks/use-role";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { getCurrentUserId } from "@/lib/auth";
import { FLAT_LIST_PERF } from "@/lib/flatList";
import { buildLeadBrowserParams } from "@/lib/lead-browser";
import { isNaLeadStatus } from "@/lib/lead-status-options";
import {
  type MobileLeadFilters,
  countActiveMobileLeadFilters,
  defaultMobileLeadFilters,
  mobileFiltersToApiParams,
} from "@/lib/leads-advanced-filters";
import {
  MOBILE_LEAD_STAGES,
  type MobileLeadsStage,
  defaultMobileLeadsStage,
  stageToLeadQuery,
} from "@/lib/leads-stage";
import { queryErrorMessage } from "@/lib/query-errors";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, shadows, spacing, typography } from "@/theme";
import { TAB_BAR_HEIGHT, TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadsScreen">;

function leadKeyExtractor(item: LeadRow) {
  return item.id;
}

export function LeadsScreen({ navigation }: Props) {
  const isAgent = useIsAgent();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stage, setStage] = useState<MobileLeadsStage>(() => defaultMobileLeadsStage());
  const [leadFilters, setLeadFilters] = useState<MobileLeadFilters>(() =>
    defaultMobileLeadFilters(isAgent),
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const fabBottom = TAB_BAR_HEIGHT + insets.bottom + spacing.md;
  const listBottomPadding = TAB_BAR_SCROLL_PADDING + insets.bottom + 72;

  const onDebouncedSearchChange = useCallback((value: string) => {
    setDebouncedSearch(value);
  }, []);

  const onOpenFilters = useCallback(() => {
    setFilterSheetOpen(true);
  }, []);

  const onCloseFilters = useCallback(() => {
    setFilterSheetOpen(false);
  }, []);

  const queryParams = useMemo(() => {
    const params: Omit<LeadsQuery, "page"> = {
      ...mobileFiltersToApiParams(leadFilters),
      ...stageToLeadQuery(stage),
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (isAgent) {
      const userId = getCurrentUserId();
      if (userId) params.assignedTo = userId;
    }
    return params;
  }, [debouncedSearch, stage, leadFilters, isAgent]);

  const activeFilterCount = countActiveMobileLeadFilters(leadFilters, { isAgent });

  const {
    data,
    isLoading,
    isPending,
    isError,
    refetch,
    isRefetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteLeads(queryParams);
  useRefreshOnFocus(refetch);

  const visibleLeads = useMemo(() => {
    const pages = data?.pages;
    if (!pages?.length) return [] as LeadRow[];
    const flat: LeadRow[] = [];
    for (const page of pages) {
      if (!Array.isArray(page?.items)) continue;
      for (const lead of page.items) {
        if (isAgent && isNaLeadStatus(lead.leadStatus)) continue;
        flat.push(lead);
      }
    }
    return flat;
  }, [data?.pages, isAgent]);

  const total = data?.pages[0]?.total ?? visibleLeads.length;
  const showInitialLoading = (isPending || isLoading) && !data;

  const onPressLead = useCallback(
    (leadId: string) => {
      navigation.navigate("LeadDetailScreen", buildLeadBrowserParams(visibleLeads, leadId));
    },
    [navigation, visibleLeads],
  );

  const renderItem: ListRenderItem<LeadRow> = useCallback(
    ({ item }) => <LeadListItem lead={item} onPress={onPressLead} />,
    [onPressLead],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onCreateLead = useCallback(() => {
    navigation.navigate("LeadCreateScreen");
  }, [navigation]);

  const emptyTitle = stage === "new" ? "No fresh New leads" : "No leads found";
  const emptyMessage =
    stage === "new"
      ? "New only shows leads from the last 24 hours. Try Pending for your assigned book."
      : "Try a different filter or create a new lead.";

  const listHeaderExtra = useMemo(
    () => (
      <View style={styles.chipsRow}>
        {MOBILE_LEAD_STAGES.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.chip, stage === item.id && styles.chipActive]}
            onPress={() => setStage(item.id)}
          >
            <Text style={[styles.chipText, stage === item.id && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    ),
    [stage],
  );

  // Keep chrome visible on errors — only block the list when we have no data at all.
  if (isError && !data && !showInitialLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Leads</Text>
        </View>
        <ErrorState
          title="Could not load leads"
          message={queryErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  const showStaleBanner = isError && Boolean(data);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Leads</Text>
          <Text style={styles.headerSub}>
            {showInitialLoading
              ? "Loading…"
              : isAgent
                ? `${total} assigned to you`
                : leadFilters.scope === "my"
                  ? `${total} assigned to you`
                  : `${total} total`}
          </Text>
        </View>
      </View>

      {showStaleBanner ? (
        <QueryErrorBanner message={queryErrorMessage(error)} onRetry={() => void refetch()} />
      ) : null}

      <LeadsSearchBar
        activeFilterCount={activeFilterCount}
        onDebouncedSearchChange={onDebouncedSearchChange}
        onOpenFilters={onOpenFilters}
      />

      {listHeaderExtra}

      {filterSheetOpen ? (
        <LeadFilterSheet
          visible
          filters={leadFilters}
          onClose={onCloseFilters}
          onApply={setLeadFilters}
        />
      ) : null}

      {showInitialLoading ? (
        <View style={styles.loadingWrap}>
          <ListSkeleton rows={5} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPadding },
            visibleLeads.length === 0 ? styles.emptyContent : null,
          ]}
          data={visibleLeads}
          keyExtractor={leadKeyExtractor}
          renderItem={renderItem}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={emptyTitle}
              message={emptyMessage}
              actionLabel={stage === "new" ? "Show Pending" : "Create lead"}
              onAction={stage === "new" ? () => setStage("pending") : onCreateLead}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : null
          }
          {...FLAT_LIST_PERF}
          // Extra Android guard — never clip empty state / rows.
          removeClippedSubviews={
            Platform.OS === "android" ? false : FLAT_LIST_PERF.removeClippedSubviews
          }
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={onCreateLead}
        accessibilityLabel="Create new lead"
        testID="create-lead-fab"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.heading, color: colors.text },
  headerSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.neuSm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.border },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  chipTextActive: { color: "#fff" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingTop: 0 },
  emptyContent: { flexGrow: 1 },
  loadingWrap: { flex: 1 },
  fab: {
    position: "absolute",
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.neu,
  },
});
