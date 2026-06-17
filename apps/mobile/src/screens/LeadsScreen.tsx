import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { type LeadRow, type LeadsQuery, useInfiniteLeads } from "@/hooks/use-leads";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { getCurrentUserId } from "@/lib/auth";
import type { LeadsStackParamList } from "@/navigation/types";
import { colors, radii, spacing, typography } from "@/theme";
import { TAB_BAR_HEIGHT, TAB_BAR_SCROLL_PADDING } from "@/theme/layout";
import { formatStatusLabel, statusStyle, temperatureStyle } from "@/theme/status";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
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
      <Ionicons name="chevron-forward" size={20} color={colors.textMutedDark} />
    </Pressable>
  );
}

export function LeadsScreen({ navigation }: Props) {
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<FilterChip>("all");
  const insets = useSafeAreaInsets();
  const fabBottom = TAB_BAR_HEIGHT + insets.bottom + spacing.md;
  const listBottomPadding = TAB_BAR_SCROLL_PADDING + insets.bottom + 72;

  const queryParams = useMemo(() => {
    const params: Omit<LeadsQuery, "page"> = {};
    if (search.trim()) params.search = search.trim();
    if (chip === "hot") params.temperature = "hot";
    if (chip === "new") params.status = "new";
    if (chip === "mine") {
      const userId = getCurrentUserId();
      if (userId) params.assignedTo = userId;
    }
    return params;
  }, [search, chip]);

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
  const total = data?.pages[0]?.total ?? leads.length;

  const chips: { id: FilterChip; label: string }[] = [
    { id: "all", label: "All" },
    { id: "mine", label: "Mine" },
    { id: "hot", label: "Hot" },
    { id: "new", label: "New" },
  ];

  if (isLoading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primaryLight} />
      </View>
    );
  }

  if (isError && !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Leads</Text>
          <Text style={styles.headerSub}>{total} total</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMutedDark} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or phone"
          placeholderTextColor={colors.textMutedDark}
          value={search}
          onChangeText={setSearch}
        />
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

      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
        data={leads}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primaryLight}
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
            onPress={() => navigation.navigate("LeadDetailScreen", { leadId: item.id })}
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
            <ActivityIndicator color={colors.primaryLight} style={{ marginVertical: spacing.md }} />
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
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.heading, color: colors.textDark },
  headerSub: { color: colors.textMutedDark, fontSize: 13, marginTop: 2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.cardDark,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingHorizontal: spacing.md,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.textDark,
    fontSize: 15,
  },
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
    backgroundColor: colors.cardDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMutedDark, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingTop: 0 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderDark,
    gap: spacing.sm,
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
  name: { color: colors.textDark, fontSize: 16, fontWeight: "700", flex: 1 },
  subline: { color: colors.textMutedDark, fontSize: 13, marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  contactLine: { color: colors.textMutedDark, fontSize: 12 },
  center: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
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
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
