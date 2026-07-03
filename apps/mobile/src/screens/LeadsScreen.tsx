import { LeadFilterSheet } from "@/components/LeadFilterSheet";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { QueryErrorBanner } from "@/components/ui/QueryErrorBanner";
import { type LeadRow, type LeadsQuery, useInfiniteLeads } from "@/hooks/use-leads";
import { useIsAgent } from "@/hooks/use-role";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { getCurrentUserId } from "@/lib/auth";
import { buildLeadBrowserParams } from "@/lib/lead-browser";
import { isNaLeadStatus } from "@/lib/lead-status-options";
import {
  type MobileLeadFilters,
  countActiveMobileLeadFilters,
  defaultMobileLeadFilters,
  mobileFiltersToApiParams,
} from "@/lib/leads-advanced-filters";
import { queryErrorMessage } from "@/lib/query-errors";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, shadows, spacing, typography } from "@/theme";
import { TAB_BAR_HEIGHT, TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { neuCard } from "@/theme/neubrutal";
import { formatStatusLabel, statusStyle, temperatureStyle } from "@/theme/status";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<LeadsStackParamList, "LeadsScreen">;

type FilterChip = "all" | "mine" | "hot" | "new";

function initials(lead: LeadRow) {
  return `${lead.firstName[0] ?? ""}${lead.lastName[0] ?? ""}`.toUpperCase();
}

function daysSinceContact(value: string | null | undefined) {
  if (!value) return "Never contacted";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days === 0) return "Contacted today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function LeadItem({ lead, onPress }: { lead: LeadRow; onPress: () => void }) {
  const status = statusStyle(lead.leadStatus);
  const temp = temperatureStyle(lead.temperature);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(lead)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {lead.firstName} {lead.lastName}
          </Text>
          <Badge
            label={formatStatusLabel(lead.leadStatus)}
            backgroundColor={status.bg}
            color={status.text}
          />
        </View>
        <Text style={styles.subline} numberOfLines={1}>
          {lead.phone ?? "No phone"}
          {lead.city ? ` · ${lead.city}` : ""}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.contactLine}>{daysSinceContact(lead.lastContactedAt)}</Text>
          {temp && lead.temperature ? (
            <Badge label={lead.temperature} backgroundColor={temp.bg} color={temp.text} />
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export function LeadsScreen({ navigation }: Props) {
  const isAgent = useIsAgent();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [chip, setChip] = useState<FilterChip>(() => (isAgent ? "mine" : "all"));
  const [leadFilters, setLeadFilters] = useState<MobileLeadFilters>(() =>
    defaultMobileLeadFilters(isAgent),
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const fabBottom = TAB_BAR_HEIGHT + insets.bottom + spacing.md;
  const listBottomPadding = TAB_BAR_SCROLL_PADDING + insets.bottom + 72;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(() => {
    const params: Omit<LeadsQuery, "page"> = {
      ...mobileFiltersToApiParams(leadFilters),
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (chip === "hot" && !params.temperature) params.temperature = "hot";
    if (chip === "new" && !params.status) params.status = "new";
    if (isAgent || chip === "mine") {
      const userId = getCurrentUserId();
      if (userId) params.assignedTo = userId;
    }
    return params;
  }, [debouncedSearch, chip, leadFilters, isAgent]);

  const activeFilterCount = countActiveMobileLeadFilters(leadFilters, { isAgent });

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteLeads(queryParams);
  useRefreshOnFocus(refetch);

  const leads = data?.pages.flatMap((page) => page.items) ?? [];
  const visibleLeads = useMemo(
    () => (isAgent ? leads.filter((lead) => !isNaLeadStatus(lead.leadStatus)) : leads),
    [isAgent, leads],
  );
  const total = data?.pages[0]?.total ?? visibleLeads.length;

  const chips: { id: FilterChip; label: string }[] = isAgent
    ? [
        { id: "mine", label: "Mine" },
        { id: "hot", label: "Hot" },
        { id: "new", label: "New" },
      ]
    : [
        { id: "all", label: "All" },
        { id: "mine", label: "Mine" },
        { id: "hot", label: "Hot" },
        { id: "new", label: "New" },
      ];

  if (isLoading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const showFatalError = isError && !data && !isLoading && !isRefetching;
  if (showFatalError) {
    return <ErrorState message={queryErrorMessage(error)} onRetry={() => void refetch()} />;
  }

  const showStaleBanner = isError && Boolean(data);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Leads</Text>
          <Text style={styles.headerSub}>
            {isAgent ? `${total} assigned to you` : `${total} total`}
          </Text>
        </View>
      </View>

      {showStaleBanner ? (
        <QueryErrorBanner message={queryErrorMessage(error)} onRetry={() => void refetch()} />
      ) : null}

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or phone"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <Pressable
          style={styles.filterBtn}
          onPress={() => setFilterSheetOpen(true)}
          accessibilityLabel="Open lead filters"
        >
          <Ionicons name="options-outline" size={22} color={colors.text} />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.chipsRow}>
        {chips.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.chip, chip === item.id && styles.chipActive]}
            onPress={() => setChip(item.id)}
          >
            <Text style={[styles.chipText, chip === item.id && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <LeadFilterSheet
        visible={filterSheetOpen}
        filters={leadFilters}
        onClose={() => setFilterSheetOpen(false)}
        onApply={setLeadFilters}
      />

      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
        data={visibleLeads}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No leads found"
            message="Try a different filter or create a new lead."
            actionLabel="Create lead"
            onAction={() => navigation.navigate("LeadCreateScreen")}
          />
        }
        renderItem={({ item }) => (
          <LeadItem
            lead={item}
            onPress={() =>
              navigation.navigate("LeadDetailScreen", buildLeadBrowserParams(visibleLeads, item.id))
            }
          />
        )}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : null
        }
      />

      <Pressable
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() => navigation.navigate("LeadCreateScreen")}
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...shadows.neuSm,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.neuSm,
  },
  filterBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  name: { color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 },
  subline: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  contactLine: { color: colors.textMuted, fontSize: 12 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
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
